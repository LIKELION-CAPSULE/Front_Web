import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiClient, ApiError } from '../src/shared/api/client.ts'
import { isRetryableMessageError, streamEventError, streamMessage } from '../src/features/backend/message-stream.ts'
import type { MessageRequest } from '../src/shared/api/types.ts'

const body: MessageRequest = { requestId: 'r-1', characterId: 3, content: '졸려', inputType: 'TEXT', tts: false }
const done = { requestId: 'r-1', characterId: 3, content: '물 마시고 와.', expression: { file: 'exp/smile.exp3.json' }, affinity: { delta: 1 } }
const json = (value: unknown, status = 200) => Response.json(status < 300 ? { success: true, data: value } : value, { status })
/** An SSE response whose body arrives in the given chunks; `cut` breaks the connection after them. */
function sse(chunks: string[], cut = false) {
  const encoder = new TextEncoder()
  let sent = false
  // The chunks are read first; erroring inside `start` would discard them.
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        if (chunks.length) return
      }
      if (cut) controller.error(new TypeError('network'))
      else controller.close()
    },
  }), { headers: { 'content-type': 'text/event-stream;charset=UTF-8' } })
}
const event = (type: string, data: unknown) => `event: ${type}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
function client(responses: (() => Response)[], seen: { url: string; init: RequestInit }[] = []) {
  return new ApiClient(async (url, init) => {
    seen.push({ url: String(url), init: init! })
    const next = responses.shift()
    if (!next) throw new Error('unexpected request')
    return next()
  })
}

test('replies replace the text, done resolves with the API 20 payload, and the request asks for SSE', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  const replies: string[] = []
  const api = client([() => sse([event('reply', { content: '물' }), 'event: reply\ndata: {"content":"물 마시', '고"}\n\n', event('done', done)])], seen)
  const result = await streamMessage(api, 12, body, { onReply: text => replies.push(text) })
  assert.deepEqual(replies, ['물', '물 마시고'])
  assert.deepEqual(result, done)
  assert.equal(seen[0]!.url, '/api/backend/connections/12/messages/stream')
  assert.equal((seen[0]!.init.headers as Record<string, string>).accept, 'text/event-stream, application/json')
  assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), body)
})

test('a done without any reply still resolves', async () => {
  const replies: string[] = []
  const result = await streamMessage(client([() => sse([event('done', done)])]), 12, body, { onReply: text => replies.push(text) })
  assert.deepEqual(replies, [])
  assert.equal(result.content, done.content)
})

test('a wrapped SSE done exposes the message payload and keeps streamed replies', async () => {
  const replies: string[] = []
  const result = await streamMessage(client([() => sse([event('reply', { content: '물' }), event('done', { success: true, data: done })])]),
    12, body, { onReply: text => replies.push(text) })
  assert.deepEqual(result, done)
  assert.deepEqual(replies, ['물'])
})

test('failed or empty SSE done envelopes never complete as a chat reply', async () => {
  for (const payload of [{ success: false, code: 'CONNECTION_ENDED', detail: { connectionId: 12 } }, { success: true, data: null }]) {
    const seen: { url: string; init: RequestInit }[] = []
    await assert.rejects(streamMessage(client([() => sse([event('done', payload)])], seen), 12, body, { onReply() {} }),
      (error: unknown) => error instanceof ApiError && error.status === 502)
    assert.equal(seen.length, 1)
  }
})

test('JSON errors before the stream opens throw like other requests and are not resent', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  await assert.rejects(
    streamMessage(client([() => json({ code: 'TOO_MANY_REQUESTS', message: 'x' }, 429)], seen), 12, body, { onReply() {} }),
    (error: unknown) => error instanceof ApiError && error.status === 429 && error.message === '요청이 많아요. 잠시 후 다시 시도해 주세요.',
  )
  assert.equal(seen.length, 1)
})

test('a successful plain JSON reply is used as the done payload', async () => {
  assert.deepEqual(await streamMessage(client([() => json(done)]), 12, body, { onReply() {} }), done)
})

test('an empty JSON envelope cannot complete as a message', async () => {
  await assert.rejects(streamMessage(client([() => json(null)]), 12, body, { onReply() {} }),
    (error: unknown) => error instanceof ApiError && error.status === 502)
})

test('error events are told apart by code (message repeats the code) and are not resent', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  const ended = { code: 'CONNECTION_ENDED', message: 'CONNECTION_ENDED', detail: {} }
  await assert.rejects(
    streamMessage(client([() => sse([event('reply', { content: '물' }), event('error', ended)])], seen), 12, body, { onReply() {} }),
    (error: unknown) => error instanceof ApiError && error.code === 'CONNECTION_ENDED' && error.message === '답장을 받는 사이 연결이 끝났어요. 연결 기록을 확인해 주세요.',
  )
  assert.equal(seen.length, 1)
  assert.equal(streamEventError(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', detail: {} })).message, '답장을 만들지 못했어요. 잠시 후 다시 보내 주세요.')
  assert.equal(streamEventError(JSON.stringify({ code: 'NEW_CODE', message: 'NEW_CODE' })).message, '답장을 받지 못했어요.')
  assert.equal(streamEventError('답장을 만들지 못했어요.').message, '답장을 만들지 못했어요.')
})

test('a cut connection or a stream without done is resent with the same requestId', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  const api = client([() => sse([event('reply', { content: '물' })], true), () => sse([event('reply', { content: '물' })]), () => sse([event('done', done)])], seen)
  assert.deepEqual(await streamMessage(api, 12, body, { onReply() {} }), done)
  assert.equal(seen.length, 3)
  assert.ok(seen.every(request => JSON.parse(String(request.init.body)).requestId === 'r-1'))
})

test('409 before the stream is final, and resending stops at the attempt limit with the last error', async () => {
  const conflictSeen: { url: string; init: RequestInit }[] = []
  await assert.rejects(
    streamMessage(client([() => json({ code: 'CONFLICT', message: 'CONFLICT' }, 409)], conflictSeen), 12, body, { onReply() {} }),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  )
  assert.equal(conflictSeen.length, 1)
  const seen: { url: string; init: RequestInit }[] = []
  const cut = () => sse([], true)
  await assert.rejects(
    streamMessage(client([cut, cut, cut, cut], seen), 12, body, { onReply() {} }, { attempts: 3 }),
    (error: unknown) => error instanceof ApiError && error.code === 'STREAM_INTERRUPTED',
  )
  assert.equal(seen.length, 3)
})

test('a resend of a request still in progress gets one done after a quiet wait, without replies', async () => {
  const replies: string[] = []
  const resent = { ...done, expression: null, emotion: null, motion: null, affinity: { delta: 0 } }
  const api = client([() => sse([event('reply', { content: '물' })], true), () => sse([': waiting\n\n', event('done', resent)])])
  assert.deepEqual(await streamMessage(api, 12, body, { onReply: text => replies.push(text) }), resent)
  assert.deepEqual(replies, ['물'])
})

test('resending stops when the session is no longer current', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  await assert.rejects(streamMessage(client([() => sse([], true), () => sse([event('done', done)])], seen), 12, body, { onReply() {}, alive: () => false }))
  assert.equal(seen.length, 1)
})

test('401 renews the token and sends the stream request once more', async () => {
  const seen: { url: string; init: RequestInit }[] = []
  const api = client([() => json({}, 401), () => json({ accessToken: 'new' }), () => sse([event('done', done)])], seen)
  api.setToken('old')
  assert.deepEqual(await streamMessage(api, 12, body, { onReply() {} }), done)
  assert.deepEqual(seen.map(request => request.url), ['/api/backend/connections/12/messages/stream', '/api/backend/auth/refresh', '/api/backend/connections/12/messages/stream'])
  assert.equal((seen[2]!.init.headers as Record<string, string>).authorization, 'Bearer new')
})

test('only lost connections are retryable', () => {
  assert.equal(isRetryableMessageError(new ApiError('x', 0)), true)
  assert.equal(isRetryableMessageError(new ApiError('x', 409)), false)
  assert.equal(isRetryableMessageError(new ApiError('x', 502, 'CONNECTION_ENDED')), false)
  assert.equal(isRetryableMessageError(new ApiError('x', 502, 'STREAM_ERROR')), false)
  assert.equal(isRetryableMessageError(new Error('x')), false)
})
