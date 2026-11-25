import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ApiError } from '../src/shared/api/client.ts'
import {
  kakaoSignupFailure, kakaoSignupRequest, readKakaoSignupRequired, KAKAO_LOGIN_PATH, KAKAO_SIGNUP_PATH,
} from '../src/features/auth/kakao-signup-contract.ts'
import {
  agreedTermVersionIds, allConsentState, canSubmitConsent, clearKakaoSignup, consentTerms, isLoginLayoutPath,
  KAKAO_TERMS_PATH, NO_CONSENT, readKakaoSignup, saveKakaoSignup, toggleAllConsent,
} from '../src/features/auth/kakao-signup.ts'
import { LocalBetaStore } from '../src/features/local-demo/store.ts'
import type { TermVersion } from '../src/shared/api/types.ts'

const NOW = 1_800_000_000_000

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const blocked = () => { throw new DOMException('Storage denied', 'SecurityError') }

// ── Adapter (contract a′): the one place that reads the server's shape ──

test('KAKAO_SIGNUP_REQUIRED becomes a sign-up ticket with a local expiry', () => {
  const error = new ApiError('KAKAO_SIGNUP_REQUIRED', 403, 'KAKAO_SIGNUP_REQUIRED', { signupToken: 'ticket-1', expiresInSeconds: 600 })
  assert.deepEqual(readKakaoSignupRequired(error, NOW), { signupToken: 'ticket-1', expiresAt: NOW + 600_000 })
  // A plain error-shaped object works too (the adapter does not depend on the client class).
  assert.deepEqual(readKakaoSignupRequired({ code: 'KAKAO_SIGNUP_REQUIRED', detail: { signupToken: 't', expiresInSeconds: 30 } }, NOW), { signupToken: 't', expiresAt: NOW + 30_000 })
})

test('a missing or garbled expiry falls back to ten minutes; no token means no ticket', () => {
  for (const expiresInSeconds of [undefined, 0, -5, Number.NaN, '600', null]) {
    const ticket = readKakaoSignupRequired(new ApiError('x', 403, 'KAKAO_SIGNUP_REQUIRED', { signupToken: 'ticket', expiresInSeconds }), NOW)
    assert.equal(ticket?.expiresAt, NOW + 600_000, String(expiresInSeconds))
  }
  for (const detail of [{}, { signupToken: '' }, { signupToken: '   ' }, { signupToken: 42 }]) {
    assert.equal(readKakaoSignupRequired(new ApiError('x', 403, 'KAKAO_SIGNUP_REQUIRED', detail), NOW), null)
  }
})

test('other step-1 errors are not tickets, so the callback keeps its existing handling', () => {
  for (const error of [new ApiError('full', 403, 'BETA_FULL'), new ApiError('bad', 401, 'SOCIAL_AUTH_FAILED'), new Error('network'), null, 'KAKAO_SIGNUP_REQUIRED']) {
    assert.equal(readKakaoSignupRequired(error, NOW), null)
  }
})

test('the sign-up request carries exactly the token, the agreed version ids and the device hash', () => {
  const ids = [990501, 990502]
  const body = kakaoSignupRequest({ signupToken: 't', agreedTermVersionIds: ids, deviceHash: 'device' })
  assert.deepEqual(body, { signupToken: 't', agreedTermVersionIds: [990501, 990502], deviceHash: 'device' })
  assert.notEqual(body.agreedTermVersionIds, ids)
  assert.deepEqual([KAKAO_LOGIN_PATH, KAKAO_SIGNUP_PATH], ['/auth/social/KAKAO', '/auth/social/KAKAO/signup'])
})

test('each sign-up failure has its own branch; anything unknown keeps the ticket for a retry', () => {
  assert.equal(kakaoSignupFailure(new ApiError('x', 401, 'SIGNUP_TOKEN_EXPIRED')), 'expired')
  assert.equal(kakaoSignupFailure(new ApiError('x', 401, 'SIGNUP_TOKEN_INVALID')), 'invalid')
  assert.equal(kakaoSignupFailure(new ApiError('x', 400, 'TERMS_NOT_AGREED')), 'terms')
  assert.equal(kakaoSignupFailure(new ApiError('x', 403, 'BETA_FULL')), 'beta-full')
  for (const error of [new ApiError('x', 500), new ApiError('x', 0), new Error('x'), undefined]) assert.equal(kakaoSignupFailure(error), 'failed')
})

// ── The ticket in session storage ──

test('the ticket survives a refresh until it expires, then reads as expired with where to go next', () => {
  const storage = memoryStorage()
  assert.equal(saveKakaoSignup({ signupToken: 'ticket', expiresAt: NOW + 1000, next: '/mates/201' }, () => storage), true)
  assert.deepEqual(readKakaoSignup(NOW, () => storage), { status: 'active', session: { signupToken: 'ticket', expiresAt: NOW + 1000, next: '/mates/201' } })
  assert.equal(readKakaoSignup(NOW + 999, () => storage).status, 'active')
  assert.deepEqual(readKakaoSignup(NOW + 1000, () => storage), { status: 'expired', next: '/mates/201' })
  clearKakaoSignup(() => storage)
  assert.deepEqual(readKakaoSignup(NOW, () => storage), { status: 'none' })
  // Only session storage is used, under one key; nothing else is written.
  assert.equal(storage.values.size, 0)
})

test('a missing, malformed or blocked ticket reads as none (the screen goes back to login)', () => {
  const storage = memoryStorage()
  for (const value of ['{', 'null', '42', '[]', '{"signupToken":"","expiresAt":1}', '{"signupToken":"t"}', '{"signupToken":"t","expiresAt":"soon"}']) {
    storage.setItem('capsule-kakao-signup', value)
    assert.deepEqual(readKakaoSignup(NOW, () => storage), { status: 'none' }, value)
  }
  assert.deepEqual(readKakaoSignup(NOW, blocked), { status: 'none' })
  assert.equal(saveKakaoSignup({ signupToken: 't', expiresAt: NOW, next: '/' }, blocked), false)
  assert.doesNotThrow(() => clearKakaoSignup(blocked))
  const discarding = memoryStorage()
  discarding.setItem = () => {}
  assert.equal(saveKakaoSignup({ signupToken: 't', expiresAt: NOW, next: '/' }, () => discarding), false)
})

// ── Consent ──

const term = (code: string, termVersionId: number, name: string, required = true): TermVersion => ({ code, termVersionId, name, required, content: '본문' })
const SERVER_TERMS = [term('PRIVACY', 12, '개인정보 처리방침'), term('MARKETING', 13, '마케팅', false), term('SERVICE', 11, '이용약관')]

test('the two required terms come in screen order with their server version ids', () => {
  assert.deepEqual(consentTerms(SERVER_TERMS), [
    { document: 'terms', termVersionId: 11, name: '이용약관' },
    { document: 'privacy', termVersionId: 12, name: '개인정보 처리방침' },
  ])
  // A term without a usable version id is not offered (so the button cannot be enabled).
  assert.deepEqual(consentTerms([term('SERVICE', 0, '이용약관'), term('PRIVACY', 12, '개인정보 처리방침')]).map(value => value.document), ['privacy'])
  assert.deepEqual(consentTerms([term('SERVICE', 11, '이용약관', false)]), [])
})

test('전체 동의 and the two terms stay in step', () => {
  const list = consentTerms(SERVER_TERMS)
  assert.equal(allConsentState(NO_CONSENT, list), false)
  const all = toggleAllConsent(NO_CONSENT, list)
  assert.deepEqual(all, { terms: true, privacy: true })
  assert.equal(allConsentState(all, list), true)
  const one = { terms: true, privacy: false }
  assert.equal(allConsentState(one, list), 'mixed')
  // From mixed, 전체 동의 turns everything on; from all on, everything off.
  assert.deepEqual(toggleAllConsent(one, list), { terms: true, privacy: true })
  assert.deepEqual(toggleAllConsent(all, list), { terms: false, privacy: false })
  assert.equal(allConsentState(NO_CONSENT, []), false)
})

test('「동의하고 시작하기」 needs readable terms, both checks and nothing in flight', () => {
  const terms = consentTerms(SERVER_TERMS)
  const checks = { terms: true, privacy: true }
  assert.equal(canSubmitConsent({ checks, terms, termsReady: true, busy: false }), true)
  assert.equal(canSubmitConsent({ checks: { terms: true, privacy: false }, terms, termsReady: true, busy: false }), false)
  assert.equal(canSubmitConsent({ checks: NO_CONSENT, terms, termsReady: true, busy: false }), false)
  assert.equal(canSubmitConsent({ checks, terms, termsReady: false, busy: false }), false)
  assert.equal(canSubmitConsent({ checks, terms, termsReady: true, busy: true }), false)
  assert.equal(canSubmitConsent({ checks, terms: terms.slice(0, 1), termsReady: true, busy: false }), false)
  assert.deepEqual(agreedTermVersionIds(checks, terms), [11, 12])
  assert.deepEqual(agreedTermVersionIds({ terms: false, privacy: true }, terms), [12])
})

test('the consent screen is drawn by the login layout', () => {
  assert.equal(KAKAO_TERMS_PATH, '/login/kakao-terms')
  for (const path of ['/login', '/login/', '/login/kakao-terms', '/login/kakao-terms/']) assert.equal(isLoginLayoutPath(path), true, path)
  for (const path of ['/', '/oauth/kakao', '/onboarding', '/login/other', '/loginx']) assert.equal(isLoginLayoutPath(path), false, path)
})

// ── The local mock (development only) ──

test('local mock: a first-time Kakao user gets a ticket, signs up once, and the QA switches reproduce each failure', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  const qa = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => qa.get(key) ?? null } })
  try {
    const { createLocalTransport } = await server.ssrLoadModule('/src/features/local-demo/transport.ts') as typeof import('../src/features/local-demo/transport.ts')
    const store = new LocalBetaStore(null)
    store.reset('guest')
    const fetch = createLocalTransport(store, async () => new Response('asset'), 'http://local.test')
    const post = async (path: string, body: object) => {
      const response = await fetch(`http://local.test/api/backend${path}`, { method: 'POST', body: JSON.stringify(body) })
      return { status: response.status, json: await response.json() }
    }
    const kakao = (code: string) => post('/auth/social/KAKAO', { code, redirectUri: 'http://local.test/oauth/kakao', deviceHash: 'device' })
    const signup = (signupToken: string, agreedTermVersionIds = [990501, 990502]) => post('/auth/social/KAKAO/signup', { signupToken, agreedTermVersionIds, deviceHash: 'device' })

    // An existing Kakao user signs in as before.
    const existing = await kakao('review-code')
    assert.equal(existing.status, 200)
    assert.equal(existing.json.data.isNewUser, false)
    store.reset('guest')

    const first = await kakao('new-user')
    assert.equal(first.status, 403)
    assert.equal(first.json.code, 'KAKAO_SIGNUP_REQUIRED')
    const ticket = readKakaoSignupRequired({ code: first.json.code, detail: first.json.detail }, Date.now())
    assert.ok(ticket)
    assert.equal(store.data.authenticated, false)
    assert.equal((await signup(ticket.signupToken, [990501])).json.code, 'TERMS_NOT_AGREED')
    const done = await signup(ticket.signupToken)
    assert.equal(done.status, 200)
    assert.equal(done.json.data.isNewUser, true)
    assert.equal(done.json.data.onboardingRequired, true)
    // Single use.
    assert.equal((await signup(ticket.signupToken)).json.code, 'SIGNUP_TOKEN_INVALID')
    assert.equal((await signup('forged')).json.code, 'SIGNUP_TOKEN_INVALID')
    assert.equal((await signup(`local-signup.${Date.now() - 1}.old`)).json.code, 'SIGNUP_TOKEN_EXPIRED')

    const fresh = (await kakao('new-again')).json.detail.signupToken as string
    for (const [value, code] of [['expired', 'SIGNUP_TOKEN_EXPIRED'], ['invalid', 'SIGNUP_TOKEN_INVALID'], ['terms', 'TERMS_NOT_AGREED']]) {
      qa.set('capsule-local-kakao-signup', value!)
      assert.equal((await signup(fresh)).json.code, code, value)
    }
    qa.set('capsule-local-kakao-signup', 'expired')
    assert.equal((await kakao('new-short')).json.detail.expiresInSeconds, 1)
    qa.clear()
    qa.set('capsule-local-beta-full', '1')
    assert.equal((await kakao('new-full')).json.code, 'BETA_FULL')
    assert.equal((await signup(fresh)).json.code, 'BETA_FULL')
  } finally {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous)
    else delete (globalThis as { sessionStorage?: unknown }).sessionStorage
    await server.close()
  }
})

test('the consent-screen flag: mock and UI review show the consent path unless QA turns it off; elsewhere the flag decides', async () => {
  const { KAKAO_SIGNUP_CONSENT_SCREEN } = await import('../src/features/auth/kakao-signup-contract.ts')
  assert.equal(typeof KAKAO_SIGNUP_CONSENT_SCREEN, 'boolean')
  const { devKakaoConsentScreen } = await import('../src/features/auth/dev-kakao-consent.ts')
  const session = new Map<string, string>()
  const saved = { document: Object.getOwnPropertyDescriptor(globalThis, 'document'), sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage') }
  const setDocument = (localDemo?: string, reviewScenario?: string) => Object.defineProperty(globalThis, 'document', { configurable: true,
    value: { body: { dataset: localDemo ? { localDemo } : {} }, documentElement: { dataset: reviewScenario ? { reviewScenario } : {} } } })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null } })
  try {
    setDocument()
    assert.equal(devKakaoConsentScreen(), undefined)
    setDocument('true')
    assert.equal(devKakaoConsentScreen(), true)
    setDocument(undefined, 'welcome')
    assert.equal(devKakaoConsentScreen(), true)
    session.set('capsule-local-kakao-consent', 'off')
    assert.equal(devKakaoConsentScreen(), false)
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
  }
})
