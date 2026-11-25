import { ApiError, toApiError, unwrapApiResponse, type ApiClient } from '../../shared/api/client.ts'
import type { MessageRequest, MessageResponse, MessageStreamAudio, MessageStreamAudioEnd, MessageStreamReply } from '../../shared/api/types.ts'

/** First send plus two resends with the same `requestId`. */
export const MESSAGE_STREAM_ATTEMPTS = 3

function parseJson(data: string): unknown {
  try { return JSON.parse(data) } catch { return null }
}

function messagePayload(value: unknown): MessageResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('답장 응답을 확인하지 못했어요.', 502)
  return value as MessageResponse
}

/** User-facing text for `error` event codes; the backend's `message` repeats the code. */
const streamErrorMessages: Record<string, string> = {
  CONNECTION_ENDED: '답장을 받는 사이 연결이 끝났어요. 연결 기록을 확인해 주세요.',
  INTERNAL_ERROR: '답장을 만들지 못했어요. 잠시 후 다시 보내 주세요.',
}

/**
 * `error` event data is the usual error body (`{ code, message, detail }`, e.g. code `CONNECTION_ENDED` or `INTERNAL_ERROR`).
 * The HTTP status is already 200, so the error is told apart by `code`; status 502 here only marks it as not resendable.
 * Plain text data is shown as it is.
 */
export function streamEventError(data: string) {
  const body = parseJson(data)
  if (body && typeof body === 'object') {
    const error = toApiError(502, body, '답장을 받지 못했어요.')
    if (error.code && streamErrorMessages[error.code]) return new ApiError(streamErrorMessages[error.code]!, 502, error.code, error.detail)
    return error
  }
  return new ApiError(data.trim() || '답장을 받지 못했어요.', 502, 'STREAM_ERROR')
}

/**
 * Only a lost connection (status 0, including a stream that ended without `done`) is sent again with the same
 * `requestId`. The server then waits for the original request (up to 8 s) and sends its stored reply as a single
 * `done`, so a reply is never saved twice. Errors before the stream (400, 404, 409, 429) and `error` events are final.
 */
export function isRetryableMessageError(error: unknown) {
  return error instanceof ApiError && error.status === 0
}

type Handlers = {
  /** Every `reply` event: the whole reply so far. */
  onReply: (content: string) => void
  /** 28 `audio` pieces (voice turns, `tts: true`), in order; `audio_end` closes them. Ignored when absent. */
  onAudio?: (audio: MessageStreamAudio) => void
  onAudioEnd?: (end: MessageStreamAudioEnd) => void
  /** Returning false stops resending (logout, another session). */
  alive?: () => boolean
}
type StreamOptions = { attempts?: number; signal?: AbortSignal }

/** API 28 `POST /connections/{id}/messages/stream`: streams one chat reply and resolves with the `done` payload (the API 20 response). */
export async function streamMessage(client: Pick<ApiClient, 'stream'>, connectionId: number, body: MessageRequest, handlers: Handlers, options: StreamOptions = {}): Promise<MessageResponse> {
  const { attempts = MESSAGE_STREAM_ATTEMPTS, signal } = options
  for (let attempt = 1; ; attempt++) {
    try {
      const received: { done?: MessageResponse } = {}
      const outcome = await client.stream<MessageResponse>(`/connections/${connectionId}/messages/stream`, { method: 'POST', body, signal }, event => {
        // Voice pieces also follow `done`; nothing else does.
        if (event.event === 'audio') { const audio = parseJson(event.data); if (audio && typeof audio === 'object') handlers.onAudio?.(audio as MessageStreamAudio); return }
        if (event.event === 'audio_end') { const end = parseJson(event.data); if (end && typeof end === 'object') handlers.onAudioEnd?.(end as MessageStreamAudioEnd); return }
        if (received.done) return
        if (event.event === 'reply') {
          const reply = parseJson(event.data) as MessageStreamReply | null
          if (typeof reply?.content === 'string' && reply.content) handlers.onReply(reply.content)
        } else if (event.event === 'done') {
          received.done = messagePayload(unwrapApiResponse<MessageResponse>(parseJson(event.data)))
        } else if (event.event === 'error') throw streamEventError(event.data)
      })
      // A JSON fallback was already unwrapped by ApiClient; SSE done accepts both the payload and its envelope.
      if (outcome.type === 'json') return messagePayload(outcome.data)
      if (received.done) return received.done
      throw new ApiError('답장이 중간에 끊겼어요. 다시 시도해 주세요.', 0, 'STREAM_INTERRUPTED')
    } catch (error) {
      if (attempt >= attempts || signal?.aborted || !isRetryableMessageError(error) || handlers.alive?.() === false) throw error
    }
  }
}

/** API 20 `POST /connections/{id}/messages`: the same request answered with one JSON response (no streaming, no voice). */
export function postMessage(client: Pick<ApiClient, 'request'>, connectionId: number, body: MessageRequest) {
  return client.request<MessageResponse>(`/connections/${connectionId}/messages`, { method: 'POST', body })
}
