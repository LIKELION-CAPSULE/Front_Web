import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLoadingScreen } from '../src/shared/lib/loading-screen.ts'

const checking = { status: 'loading', loadingStage: 'auth', loggedIn: false, onboarded: false } as const
const identified = { ...checking, loadingStage: 'page' } as const
const ready = { status: 'ready', loadingStage: 'page', loggedIn: true, onboarded: true } as const

test('authentication checks never presume the destination, including reloads with a known previous profile', () => {
  for (const path of ['/', '/onboarding', '/mypage', '/rooms/101', '/study/9001']) {
    assert.equal(resolveLoadingScreen(path, checking), null)
    assert.equal(resolveLoadingScreen(path, { ...checking, loggedIn: true, onboarded: true }), null)
  }
})

test('verified onboarding requirements take priority over the originally requested protected screen', () => {
  for (const path of ['/', '/mypage', '/rooms/101/prepare', '/reports/9001']) {
    assert.equal(resolveLoadingScreen(path, { ...checking, loadingStage: 'onboarding' }), 'onboarding')
    assert.equal(resolveLoadingScreen(path, { ...ready, onboarded: false }), 'onboarding')
  }
})

test('verified destinations use their screen, with retired account URLs loading the home background', () => {
  for (const [path, screen] of Object.entries({
    '/': 'home', '/?source=login': 'home', '/?account=profile': 'home', '/?account=schedule': 'home', '/onboarding': 'onboarding', '/mypage': 'home',
    '/mates/chaerin': 'mate', '/connect/chaerin': 'connection', '/connections/9001': 'connection-record', '/mypage#schedule': 'home', '/mypage?add=1': 'home',
    '/mates/me': 'my-mates', '/mates/me/': 'my-mates', '/records': 'records', '/records?range=month': 'records', '/credits': 'credits',
    '/credits/invite': 'invite', '/credits/charge': 'invite', '/invite': 'invite',
  })) {
    assert.equal(resolveLoadingScreen(path, identified), screen)
    assert.equal(resolveLoadingScreen(path, ready), screen)
  }
})

test('retired beta addresses only redirect: they keep the common loading screen', () => {
  for (const path of ['/rooms/101', '/rooms/101/prepare', '/study/9001?chat=1', '/reports/9001', '/capsules/9001', '/characters', '/characters/3']) {
    assert.equal(resolveLoadingScreen(path, identified), null)
    assert.equal(resolveLoadingScreen(path, ready), null)
  }
})

test('public auth screens and unresolved, signed-out or failed destinations keep the common loading screen', () => {
  for (const path of [null, '/login?mode=signup', '/oauth/kakao?code=test', '/password/reset?token=test', '/reset-password', '/unknown', 'https://external.invalid/', '//external.invalid/', '/\\external.invalid/', '/\\[invalid']) {
    assert.equal(resolveLoadingScreen(path, ready), null)
  }
  assert.equal(resolveLoadingScreen('/', { ...ready, loggedIn: false }), null)
  assert.equal(resolveLoadingScreen('/mypage', { ...identified, status: 'error' }), null)
})
