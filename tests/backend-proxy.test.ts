import test from 'node:test'
import assert from 'node:assert/strict'
import { proxyBackend } from '../server/backend-proxy.ts'

test('gateway maps only API paths and forwards only the refresh cookie and required headers', async t => {
  let target = ''
  let options: RequestInit | undefined
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    target = String(url); options = init
    return Response.json({ ok: true })
  })
  const response = await proxyBackend(new Request('https://front.example/api/backend/me/memories?status=ALL', {
    headers: { cookie: 'analytics=secret; refresh_token=refresh; unrelated=private', authorization: 'Bearer access', 'x-private': 'secret' },
  }), { BACKEND_API_ORIGIN: 'https://backend.example' })
  assert.equal(response.status, 200)
  assert.equal(target, 'https://backend.example/api/me/memories?status=ALL')
  const headers = new Headers(options?.headers)
  assert.equal(headers.get('cookie'), 'refresh_token=refresh')
  assert.equal(headers.get('authorization'), 'Bearer access')
  assert.equal(headers.has('x-private'), false)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('refresh cookie becomes same-origin HttpOnly with correct production and local flags', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204, headers: {
    'set-cookie': 'refresh_token=rotated; Domain=backend.example; Path=/api/auth; Secure; SameSite=None; Max-Age=3600',
  } }))
  for (const origin of ['http://localhost:5173', 'https://front.example']) {
    const response = await proxyBackend(new Request(origin + '/api/backend/auth/refresh', { method: 'POST' }), {})
    const cookie = response.headers.getSetCookie()[0]!
    assert.match(cookie, /Path=\/api\/backend/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Max-Age=3600/)
    assert.doesNotMatch(cookie, /Domain=/i)
    assert.equal(cookie.includes('Secure'), origin.startsWith('https:'))
  }
})

test('gateway rejects foreign-origin mutations before contacting the backend', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const response = await proxyBackend(new Request('https://front.example/api/backend/auth/logout', { method: 'POST', headers: { origin: 'https://attacker.example' } }), {})
  assert.equal(response.status, 403)
  assert.equal(fetch.mock.callCount(), 0)
})

test('gateway preserves request JSON and backend error statuses', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: URL, init: RequestInit) => {
    assert.equal(new TextDecoder().decode(init.body as ArrayBuffer), '{"nickname":"tester"}')
    return Response.json({ code: 'INVALID_NICKNAME' }, { status: 400 })
  })
  const response = await proxyBackend(new Request('http://localhost:5173/api/backend/me', { method: 'PATCH', body: '{"nickname":"tester"}' }), {})
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { code: 'INVALID_NICKNAME' })
})

test('upstream failure is a readable 502 and never a fake success', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network') })
  const response = await proxyBackend(new Request('https://front.example/api/backend/me'), {})
  assert.equal(response.status, 502)
})
