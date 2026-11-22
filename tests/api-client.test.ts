import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiClient, ApiError, toApiError } from '../src/shared/api/client.ts'

const json = (body: unknown, status = 200) => Response.json(status < 300 ? { success: true, data: body } : body, { status })

test('current API envelopes expose the payload for public reads, login and session creation', async () => {
  const responses = new Map<string, { status: number; data: unknown }>([
    ['/terms', { status: 200, data: { terms: [{ termVersionId: 1, required: true }] } }],
    ['/auth/email/login', { status: 200, data: { accessToken: 'login-token', userId: 7 } }],
    ['/sessions', { status: 201, data: { sessionId: 31, targetMinutes: 50 } }],
  ])
  const client = new ApiClient(async url => {
    const response = responses.get(String(url).replace('/api/backend', ''))!
    return json(response.data, response.status)
  })
  assert.deepEqual(await client.request('/terms', { auth: false }), responses.get('/terms')!.data)
  for (const path of ['/auth/email/login', '/sessions']) {
    assert.deepEqual(await client.request(path, { method: 'POST', auth: false, body: {} }), responses.get(path)!.data)
  }
})

test('payload data fields are preserved and legacy responses remain compatible', async () => {
  const payload = { data: { value: 42 }, success: false }
  const wrapped = new ApiClient(async () => json(payload))
  assert.deepEqual(await wrapped.request('/home'), payload)
  const legacy = new ApiClient(async () => Response.json({ userId: 7 }))
  assert.deepEqual(await legacy.request('/me'), { userId: 7 })
})

test('empty successful envelopes complete without inventing response fields', async () => {
  for (const response of [{ success: true, data: null }, { success: true }]) {
    const client = new ApiClient(async () => Response.json(response))
    assert.equal(await client.request('/auth/logout', { method: 'POST', auth: false }), null)
  }
})

test('failed API envelopes preserve the backend code and details even with HTTP 200', async () => {
  for (const status of [200, 409]) {
    const client = new ApiClient(async () => Response.json({ success: false, code: 'SESSION_ALREADY_IN_PROGRESS',
      message: 'SESSION_ALREADY_IN_PROGRESS', detail: { sessionId: 31 } }, { status }))
    await assert.rejects(client.request('/sessions', { method: 'POST', body: {} }), error =>
      error instanceof ApiError && error.status === (status === 200 ? 502 : status)
      && error.code === 'SESSION_ALREADY_IN_PROGRESS' && error.detail.sessionId === 31)
  }
})

test('concurrent GETs share one request, while later reads still reach the server', async () => {
  let calls = 0
  const client = new ApiClient(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return json({ id: 1 }) })
  const values = await Promise.all([client.request('/me'), client.request('/me')])
  assert.equal(calls, 1)
  assert.deepEqual(values, [{ id: 1 }, { id: 1 }])
  await client.request('/me')
  assert.equal(calls, 2)
})

test('mutations, separate signals and authentication modes never share a GET task', async () => {
  let calls = 0
  const client = new ApiClient(async () => { calls++; return json({ ok: true }) })
  await Promise.all([
    client.request('/me', { method: 'PATCH', body: {} }), client.request('/me', { method: 'PATCH', body: {} }),
    client.request('/me', { signal: new AbortController().signal }), client.request('/me', { signal: new AbortController().signal }),
    client.request('/me', { auth: false }), client.request('/me'),
  ])
  assert.equal(calls, 6)
})

test('new authentication never reuses a pending response from the previous account', async () => {
  const replies: ((response: Response) => void)[] = []
  const client = new ApiClient(async () => new Promise<Response>(resolve => { replies.push(resolve) }))
  client.setToken('account-a')
  const old = client.request('/me')
  client.setToken('account-b')
  const current = client.request('/me')
  assert.equal(replies.length, 2)
  replies[1]!(json({ userId: 2 }))
  assert.deepEqual(await current, { userId: 2 })
  replies[0]!(json({ userId: 1 }))
  assert.deepEqual(await old, { userId: 1 })
})

test('a shared GET failure does not suppress a later retry', async () => {
  let calls = 0
  const client = new ApiClient(async () => { calls++; return calls === 1 ? json({ code: 'UNAVAILABLE' }, 503) : json({ ok: true }) })
  const failures = await Promise.allSettled([client.request('/home'), client.request('/home')])
  assert.equal(calls, 1)
  assert.ok(failures.every(result => result.status === 'rejected'))
  assert.deepEqual(await client.request('/home'), { ok: true })
  assert.equal(calls, 2)
})

test('a read after a successful write never joins an older pending read', async () => {
  const replies: ((response: Response) => void)[] = []
  const client = new ApiClient(async (_url, options) => options?.method === 'POST'
    ? json({ saved: true })
    : new Promise<Response>(resolve => { replies.push(resolve) }))
  const old = client.request('/me/memories')
  await client.request('/me/memories', { method: 'POST', body: {} })
  const updated = client.request('/me/memories')
  assert.equal(replies.length, 2)
  replies[1]!(json({ memories: ['saved'] }))
  assert.deepEqual(await updated, { memories: ['saved'] })
  replies[0]!(json({ memories: [] }))
  await old
})

test('public authentication uses same-origin cookies without bearer and handles 204', async () => {
  const calls: RequestInit[] = []
  const client = new ApiClient(async (_url, init) => { calls.push(init!); return new Response(null, { status: 204 }) })
  client.setToken('private-token')
  assert.equal(await client.request('/auth/logout', { method: 'POST', auth: false }), null)
  assert.equal(calls[0]?.credentials, 'same-origin')
  assert.equal(new Headers(calls[0]?.headers).has('authorization'), false)
})

test('parallel expired requests share one refresh and retry the original bodies', async () => {
  let refreshed = 0
  const bodies: string[] = []
  const client = new ApiClient(async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) {
      refreshed++
      await new Promise(resolve => setTimeout(resolve, 5))
      return json({ accessToken: 'fresh' })
    }
    bodies.push(String(init?.body))
    return new Headers(init?.headers).get('authorization') === 'Bearer fresh' ? json({ saved: true }) : json({ code: 'AUTH_TOKEN_EXPIRED' }, 401)
  })
  client.setToken('expired')
  const results = await Promise.all([1, 2, 3].map(value => client.request('/sessions/10/messages', { method: 'POST', body: { value } })))
  assert.equal(refreshed, 1)
  assert.equal(results.length, 3)
  for (const value of [1, 2, 3]) assert.equal(bodies.filter(body => body === JSON.stringify({ value })).length, 2)
})

test('bad login never triggers a refresh and returns a useful error', async () => {
  let calls = 0
  const client = new ApiClient(async () => { calls++; return json({ code: 'INVALID_CREDENTIALS', message: 'INVALID_CREDENTIALS' }, 401) })
  await assert.rejects(client.request('/auth/email/login', { auth: false, method: 'POST', body: {} }), error => error instanceof ApiError && error.code === 'INVALID_CREDENTIALS' && error.message.includes('비밀번호'))
  assert.equal(calls, 1)
})

test('invalid refresh expires the application session without repeated retries', async () => {
  let expired = 0
  let calls = 0
  const client = new ApiClient(async () => { calls++; return json({ code: 'REFRESH_TOKEN_INVALID' }, 401) })
  client.setToken('expired')
  client.onExpired(() => expired++)
  await assert.rejects(client.request('/me'), ApiError)
  assert.equal(expired, 1)
  assert.equal(calls, 2)
})

test('a delayed refresh cannot restore a token after logout', async () => {
  let release!: (response: Response) => void
  const client = new ApiClient(async () => new Promise<Response>(resolve => { release = resolve }))
  const task = client.refresh()
  client.setToken(null)
  release(json({ accessToken: 'stale' }))
  assert.equal(await task, false)
})

test('a delayed withdrawal 401 never retries with a different account or logs that account out', async () => {
  const calls: RequestInit[] = []
  let finish!: (response: Response) => void
  let expired = 0
  const client = new ApiClient(async (_url, options) => {
    calls.push(options!)
    return new Promise<Response>(resolve => { finish = resolve })
  })
  client.onExpired(() => expired++)
  client.setToken('account-a')
  const withdrawal = client.request('/me', { method: 'DELETE' })
  client.setToken('account-b')
  finish(json({ code: 'UNAUTHORIZED' }, 401))
  await assert.rejects(withdrawal, error => error instanceof ApiError && error.code === 'AUTH_SESSION_CHANGED')
  assert.equal(calls.length, 1)
  assert.equal(new Headers(calls[0]?.headers).get('authorization'), 'Bearer account-a')
  assert.equal(expired, 0)
})

test('account changes during token refresh cannot replay a pending withdrawal', async () => {
  let finish!: (response: Response) => void
  let refreshing!: () => void
  const beganRefresh = new Promise<void>(resolve => { refreshing = resolve })
  let deletions = 0, expired = 0
  const client = new ApiClient(async (url) => {
    if (String(url).endsWith('/auth/refresh')) {
      refreshing()
      return new Promise<Response>(resolve => { finish = resolve })
    }
    deletions++
    return json({ code: 'UNAUTHORIZED' }, 401)
  })
  client.onExpired(() => expired++)
  client.setToken('account-a')
  const withdrawal = client.request('/me', { method: 'DELETE' })
  await beganRefresh
  client.setToken('account-b')
  finish(json({ accessToken: 'stale-account-a' }))
  await assert.rejects(withdrawal, error => error instanceof ApiError && error.code === 'AUTH_SESSION_CHANGED')
  assert.equal(deletions, 1)
  assert.equal(expired, 0)
})

test('mutations are not retried for server errors and preserve conflict details', async () => {
  let calls = 0
  const client = new ApiClient(async () => { calls++; return json({ code: 'SESSION_ALREADY_IN_PROGRESS', detail: { sessionId: 123 } }, 409) })
  await assert.rejects(client.request('/sessions', { method: 'POST', body: {} }), error => error instanceof ApiError && error.detail.sessionId === 123)
  assert.equal(calls, 1)
})

test('public API error codes remain inspectable while their wire messages become readable', () => {
  for (const [status, code] of [[400, 'INVALID_TARGET_MINUTES'], [400, 'CHARACTER_NOT_IN_ROOM'], [403, 'ONBOARDING_REQUIRED'], [404, 'ROOM_NOT_FOUND'], [500, 'INTERNAL_ERROR']] as const) {
    const error = toApiError(status, { success: false, code, message: code, detail: { sessionId: 31 } })
    assert.equal(error.status, status)
    assert.equal(error.code, code)
    assert.deepEqual(error.detail, { sessionId: 31 })
    assert.notEqual(error.message, code)
    assert.match(error.message, /[가-힣]/)
  }
  assert.equal(toApiError(503, { code: 'FUTURE_CODE', message: '서버에서 제공한 안내' }).message, '서버에서 제공한 안내')
  for (const code of ['FUTURE_CODE', 'constructor', '__proto__']) {
    const error = toApiError(503, { code, message: code })
    assert.equal(error.code, code)
    assert.equal(error.message, '요청을 처리하지 못했어요. (503)')
  }
})

test('network and malformed success responses cannot be treated as success', async () => {
  const broken = new ApiClient(async () => { throw new Error('network') })
  await assert.rejects(broken.request('/me'), error => error instanceof ApiError && error.status === 0)
  const html = new ApiClient(async () => new Response('<html>bad gateway</html>'))
  await assert.rejects(html.request('/me'), error => error instanceof ApiError && error.status === 502)
})

test('a rejected fresh access token clears the login instead of looping refresh', async () => {
  let refreshes = 0, expired = 0
  const client = new ApiClient(async url => {
    if (String(url).endsWith('/auth/refresh')) { refreshes++; return json({ accessToken: 'still-invalid' }) }
    return json({ code: 'AUTH_TOKEN_EXPIRED' }, 401)
  })
  client.onExpired(() => expired++)
  await assert.rejects(client.request('/me'), ApiError)
  assert.equal(refreshes, 1)
  assert.equal(expired, 1)
})
