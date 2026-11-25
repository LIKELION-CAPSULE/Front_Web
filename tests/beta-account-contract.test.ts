import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import type { BackendContextValue } from '../src/features/backend/backend-context.ts'
import type { BetaAccountDetails, BetaAccountPort, BetaAccountResult } from '../src/features/auth/beta-account.ts'

test('beta account operations preserve birth dates, validate responses, and reject late results from another login', async () => {
  let userId = 7, nickname = '서버 이름', onboardingRequired = true, wrongProfileUser = false
  const requests: { path: string; method: string; body: Record<string, unknown> }[] = []
  const me = () => ({ userId, nickname, onboardingRequired })
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace('/api/backend', '')
    const body = JSON.parse(String(init?.body ?? '{}'))
    requests.push({ path, method: init?.method ?? 'GET', body })
    let data: unknown
    if (path === '/me' && init?.method === 'PATCH') { nickname = String(body.nickname); data = { ...me(), userId: wrongProfileUser ? 99 : userId } }
    else if (path === '/me') data = me()
    else if (path === '/home') data = { mates: [] }
    else if (path === '/avatars') data = { avatars: [] }
    else throw new Error(`Unexpected API request: ${path}`)
    return new Response(JSON.stringify({ success: true, data }), { headers: { 'content-type': 'application/json' } })
  }
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = transport
    const provider = await server.ssrLoadModule('/src/features/demo/DemoProvider.tsx')
    const context = await server.ssrLoadModule('/src/features/backend/backend-context.ts')
    globalThis.fetch = originalFetch
    function capture(accountPort?: BetaAccountPort) {
      let value!: BackendContextValue
      function Capture() { value = context.useBackend(); return null }
      renderToString(createElement(MemoryRouter, null, createElement(provider.DemoProvider, { accountPort }, createElement(Capture))))
      return value
    }

    const legacy = capture()
    assert.equal(legacy.betaSignup, null)
    assert.equal(legacy.completeOnboarding, null)
    assert.equal(legacy.saveBetaProfile, null)
    await legacy.authenticate({ accessToken: 'isolated-token' })
    await assert.rejects(legacy.saveProfile('   '), { status: 400 })
    assert.equal(requests.some(request => request.method === 'PATCH'), false)
    await legacy.saveProfile('  새 이름  ', 55)
    assert.deepEqual(requests.at(-1)?.body, { nickname: '새 이름', avatarId: 55 })
    wrongProfileUser = true
    await assert.rejects(legacy.saveProfile('다른 계정의 응답'), { status: 502 })
    wrongProfileUser = false

    let signups = 0, completions = 0, wrongBirth = true, failRead = false, release: ((result: BetaAccountResult) => void) | undefined
    const details: BetaAccountDetails = { callName: '', aboutMe: '' }
    const readUsers: number[] = []
    const port: BetaAccountPort = {
      read: async id => { readUsers.push(id); if (failRead) throw new Error('isolated read failure'); return details },
      signup: async () => { signups++; return { accessToken: 'isolated-beta', userId } },
      completeOnboarding: async (_id, input) => {
        completions++
        return { me: { ...me(), onboardingRequired: false }, details: { ...details, birthDate: wrongBirth ? '2001-01-01' : input.birthDate } }
      },
      saveProfile: () => new Promise(resolve => { release = resolve }),
    }
    const beta = capture(port)
    const signup = { verificationToken: 'test-verification', password: 'not-a-real-password', nickname: '가입 이름', birthDate: '2000-01-01', agreedTermVersionIds: [1, 2] }
    await assert.rejects(beta.betaSignup!({ ...signup, birthDate: '2020-01-01' }), { status: 400 })
    await assert.rejects(beta.betaSignup!({ ...signup, birthDate: '2000-02-30' }), { status: 400 })
    assert.equal(signups, 0)
    await beta.betaSignup!(signup)
    assert.equal(signups, 1)
    await beta.authenticate({ accessToken: 'isolated-beta' })
    await assert.rejects(beta.completeOnboarding!({ nickname, birthDate: '2020-01-01' }), { status: 400 })
    assert.equal(completions, 0)
    await assert.rejects(beta.completeOnboarding!({ nickname, birthDate: signup.birthDate }), { status: 502 })
    wrongBirth = false
    await beta.completeOnboarding!({ nickname, birthDate: signup.birthDate })
    assert.equal(completions, 2)

    const stale = beta.saveBetaProfile!({ nickname: '이전 계정', callName: '호칭', aboutMe: '소개' })
    assert.ok(release)
    userId = 8; nickname = '두 번째 계정'; onboardingRequired = false
    failRead = true
    await assert.rejects(beta.authenticate({ accessToken: 'isolated-failed-second' }), /isolated read failure/)
    const before = requests.filter(request => request.method === 'PATCH').length
    await assert.rejects(beta.saveProfile('이전 계정으로 저장하면 안 됨'), { status: 401 })
    assert.equal(requests.filter(request => request.method === 'PATCH').length, before)
    failRead = false
    await beta.authenticate({ accessToken: 'isolated-second' })
    release!({ me: { userId: 7, nickname: '늦은 응답', onboardingRequired: false }, details })
    await assert.rejects(stale, { status: 401, code: 'AUTH_SESSION_CHANGED' })
    await beta.saveProfile('현재 계정 이름')
    assert.deepEqual(readUsers, [7, 8, 8])
    assert.equal(requests.at(-1)?.body.nickname, '현재 계정 이름')
  } finally { globalThis.fetch = originalFetch; await server.close() }
})
