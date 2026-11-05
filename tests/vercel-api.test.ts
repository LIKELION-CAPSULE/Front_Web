import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { env } from 'node:process'
import gateway from '../api/router.ts'

const origin = 'https://capsule-front-web.vercel.app'

test('Vercel refresh reaches the backend and returns its JSON 401 instead of a platform 404', async t => {
  const previous = env.BACKEND_API_ORIGIN
  env.BACKEND_API_ORIGIN = 'https://backend.example'
  t.after(() => { if (previous === undefined) delete env.BACKEND_API_ORIGIN; else env.BACKEND_API_ORIGIN = previous })
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(String(url), 'https://backend.example/api/auth/refresh')
    assert.equal(init.method, 'POST')
    return Response.json({ code: 'REFRESH_TOKEN_INVALID' }, { status: 401 })
  })
  const response = await gateway.fetch(new Request(origin + '/api/backend/auth/refresh', { method: 'POST' }))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { code: 'REFRESH_TOKEN_INVALID' })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('Vercel preserves nested API paths, queries, JSON and same-origin refresh cookies', async t => {
  const previous = env.BACKEND_API_ORIGIN
  env.BACKEND_API_ORIGIN = 'https://backend.example'
  t.after(() => { if (previous === undefined) delete env.BACKEND_API_ORIGIN; else env.BACKEND_API_ORIGIN = previous })
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(String(url), 'https://backend.example/api/sessions/123/events/456/reaction?tts=false')
    assert.equal(new TextDecoder().decode(init.body as ArrayBuffer), '{"requestId":"test"}')
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-access')
    assert.equal(new Headers(init.headers).get('cookie'), 'refresh_token=test-refresh')
    return Response.json({ characters: [] }, { headers: {
      'set-cookie': 'refresh_token=rotated; Domain=backend.example; Path=/api/auth; Secure; SameSite=None',
    } })
  })
  const response = await gateway.fetch(new Request(origin + '/api/backend/sessions/123/events/456/reaction?tts=false', {
    method: 'POST', body: '{"requestId":"test"}', headers: {
      origin, authorization: 'Bearer test-access', 'content-type': 'application/json',
      cookie: 'analytics=private; refresh_token=test-refresh',
    },
  }))
  const cookie = response.headers.getSetCookie()[0]!
  assert.match(cookie, /Path=\/api\/backend/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Lax/)
  assert.doesNotMatch(cookie, /Domain=/i)
})

test('Vercel SPA fallback includes app deep links and excludes every API route', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const routes = config.rewrites.filter((rule: { destination: string }) => rule.destination === '/index.html')
    .map((rule: { source: string }) => new RegExp(`^${rule.source}$`)) as RegExp[]
  const apiRoute = config.rewrites.find((rule: { destination: string }) => rule.destination === '/api/router')
  assert.ok(apiRoute)
  const apiPattern = new RegExp(`^${apiRoute.source}$`)
  for (const path of ['/', '/login', '/oauth/kakao', '/password/reset', '/rooms/1', '/study/123', '/reports/123', '/apiary']) {
    assert.ok(routes.some(route => route.test(path)), path)
  }
  for (const path of ['/api', '/api/backend/terms', '/api/backend/auth/refresh', '/api/backend/sessions/1/events', '/api/chat', '/api/unknown']) {
    assert.equal(routes.some(route => route.test(path)), false, path)
    if (path !== '/api') assert.ok(apiPattern.test(path), path)
  }
})

test('unknown Vercel API paths return a JSON 404 without contacting an upstream', async t => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const response = await gateway.fetch(new Request(origin + '/api/unknown'))
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type')!, /application\/json/)
  assert.equal(fetch.mock.callCount(), 0)
})
