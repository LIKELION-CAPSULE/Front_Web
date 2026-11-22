export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly detail: Record<string, unknown>
  constructor(message: string, status: number, code?: string, detail: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

import { createSseParser, type SseEvent } from './sse.ts'
import type { ApiResponse } from './types.ts'

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal }
/** `events`: the reply was an event stream and every event was delivered. `json`: the server answered with plain JSON. */
export type StreamResult<T> = { type: 'events' } | { type: 'json'; data: T }

/** Decode the current wire envelope once. Raw payloads still support older servers and SSE done events. */
export function unwrapApiResponse<T>(value: unknown): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const body = value as ApiResponse<T>
    if (body.success === false) throw toApiError(502, value)
    if (body.success === true) return (body.data ?? null) as T
  }
  return value as T
}

/** Access tokens stay in memory; refresh is serialized and uses an HttpOnly cookie. */
export class ApiClient {
  private token: string | null = null
  private refreshTask: Promise<boolean> | null = null
  private generation = 0
  private session = 0
  private expired: (() => void) | null = null
  private readonly reads = new Map<string, Promise<unknown>>()
  private readonly transport: typeof fetch
  private readonly base: string
  constructor(transport: typeof fetch = globalThis.fetch.bind(globalThis), base = '/api/backend') {
    this.transport = transport
    this.base = base
  }
  setToken(token: string | null) { this.session++; this.replaceToken(token) }
  private replaceToken(token: string | null) { this.token = token; this.generation++; this.reads.clear() }
  onExpired(callback: (() => void) | null) { this.expired = callback }
  async waitForRefresh() { await this.refreshTask?.catch(() => false) }
  async refresh(): Promise<boolean> {
    if (this.refreshTask) return this.refreshTask
    const generation = this.generation
    const task = (async () => {
      try {
        const data = await this.request<{ accessToken?: string }>('/auth/refresh', { method: 'POST', auth: false })
        if (generation !== this.generation) return false
        if (!data?.accessToken) throw new ApiError('로그인 응답을 확인하지 못했어요.', 502)
        this.replaceToken(data.accessToken)
        return true
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) return false
        throw error
      }
    })()
    this.refreshTask = task
    try { return await task } finally { if (this.refreshTask === task) this.refreshTask = null }
  }
  async request<T>(path: string, options: Options = {}, retry = true): Promise<T> {
    // Share concurrent reads only. Mutations and individually cancellable requests stay independent.
    if ((options.method ?? 'GET').toUpperCase() !== 'GET' || options.body !== undefined || options.signal || !retry) {
      return this.perform<T>(path, options, retry)
    }
    const key = JSON.stringify([this.generation, options.auth !== false, path])
    const existing = this.reads.get(key)
    if (existing) return existing as Promise<T>
    const task = this.perform<T>(path, options, retry)
    this.reads.set(key, task)
    try { return await task } finally { if (this.reads.get(key) === task) this.reads.delete(key) }
  }
  /**
   * POSTs and reads a `text/event-stream` reply, calling `onEvent` for every event in order.
   * Errors before the stream opens arrive as JSON and throw `ApiError` like `request`; any other JSON body is returned
   * as `{ type: 'json' }`. A cut connection throws `ApiError` with status 0 and code `STREAM_INTERRUPTED`.
   * An exception thrown by `onEvent` stops reading and propagates unchanged.
   */
  async stream<T>(path: string, options: Options, onEvent: (event: SseEvent) => void): Promise<StreamResult<T>> {
    // The backend picks SSE by path, not by Accept, so the proxy's fixed `accept: application/json` is fine.
    // Never send `text/event-stream` alone: errors before the stream opens are JSON.
    const response = await this.send(path, options, true, 'text/event-stream, application/json')
    if (!response.ok || !/^text\/event-stream\b/i.test(response.headers.get('content-type') ?? '')) {
      return { type: 'json', data: await this.read<T>(response, options) }
    }
    this.reads.clear()
    if (!response.body) throw new ApiError('서버 응답 형식을 확인하지 못했어요.', 502)
    const parser = createSseParser(onEvent)
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<string>
        try { chunk = await reader.read() } catch (error) {
          if (options.signal?.aborted) throw error
          throw new ApiError('서버와 연결이 끊겼어요. 다시 시도해 주세요.', 0, 'STREAM_INTERRUPTED')
        }
        if (chunk.done) break
        parser.push(chunk.value)
      }
      parser.end()
    } finally { reader.cancel().catch(() => { /* Already closed. */ }) }
    return { type: 'events' }
  }
  private async perform<T>(path: string, options: Options, retry: boolean): Promise<T> {
    return this.read<T>(await this.send(path, options, retry, 'application/json'), options)
  }
  /** Sends once, renewing the access token and sending again on the first 401. */
  private async send(path: string, options: Options, retry: boolean, accept: string): Promise<Response> {
    const token = this.token
    const session = this.session
    const headers: Record<string, string> = { accept }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.auth !== false && token) headers.authorization = `Bearer ${token}`
    let response: Response
    try {
      response = await this.transport(this.base + path, {
        method: options.method ?? 'GET', headers, credentials: 'same-origin', cache: 'no-store',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
      })
    } catch (error) {
      if (options.signal?.aborted) throw error
      throw new ApiError('서버에 연결하지 못했어요. 다시 시도해 주세요.', 0)
    }
    if (response.status === 401 && options.auth !== false) {
      const changed = () => new ApiError('로그인 상태가 변경됐어요. 다시 시도해 주세요.', 401, 'AUTH_SESSION_CHANGED')
      if (session !== this.session) throw changed()
      const renewed = retry && ((this.token && this.token !== token) || await this.refresh())
      if (session !== this.session) throw changed()
      if (renewed) return this.send(path, options, false, accept)
      this.setToken(null)
      this.expired?.()
    }
    return response
  }
  /** Parses the JSON envelope, throwing `ApiError` for HTTP or application failures. */
  private async read<T>(response: Response, options: Options): Promise<T> {
    const raw = await response.text()
    let data: unknown = null
    try { data = raw ? JSON.parse(raw) : null } catch { /* Error pages can be HTML. */ }
    if (!response.ok) throw toApiError(response.status, data)
    if (raw && data === null) throw new ApiError('서버 응답 형식을 확인하지 못했어요.', 502)
    const payload = unwrapApiResponse<T>(data)
    // A read started before a successful write must not serve as the write's follow-up read.
    if (!['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase())) this.reads.clear()
    return payload
  }
}

/** Builds the user-facing error for an error body (`{ code, message, detail }`) and status. */
export function toApiError(status: number, data: unknown, fallbackMessage?: string) {
  const body = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const fallback = fallbackMessage ?? (status === 401 ? '로그인이 필요해요.' : status === 403 ? '접근할 수 없어요.' :
    status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : `요청을 처리하지 못했어요. (${status})`)
  const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : fallback
  const code = typeof body.code === 'string' ? body.code : undefined
  const detail = body.detail && typeof body.detail === 'object' ? body.detail as Record<string, unknown> : {}
  const translated = code && Object.hasOwn(errorMessages, code) ? errorMessages[code] : undefined
  return new ApiError(translated ?? (message === code ? fallback : message), status, code, detail)
}

const errorMessages: Record<string, string> = {
  INVALID_REQUEST: '요청 내용을 확인해 주세요.', UNAUTHORIZED: '로그인이 필요해요.',
  AUTH_TOKEN_EXPIRED: '로그인이 만료됐어요. 다시 로그인해 주세요.', REFRESH_TOKEN_INVALID: '다시 로그인해 주세요.',
  NOT_FOUND: '요청한 정보를 찾지 못했어요.', METHOD_NOT_ALLOWED: '지원하지 않는 요청이에요.',
  INTERNAL_ERROR: '서버에서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
  INVALID_SETTING: '현재 설정을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.', LOGIN_LOCKED: '로그인을 여러 번 실패했어요. 5분 뒤 다시 시도해 주세요.',
  INVALID_EMAIL: '이메일 주소를 확인해 주세요.', EMAIL_ALREADY_USED: '이미 가입한 이메일이에요.', INVALID_PASSWORD: '비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.',
  INVALID_NICKNAME: '닉네임은 1~20자로 입력해 주세요.', INVALID_CODE: '인증번호가 올바르지 않아요.', CODE_EXPIRED: '인증번호의 유효 시간이 지났어요.',
  VERIFICATION_EXPIRED: '이메일 인증이 만료됐어요. 인증번호를 다시 받아 주세요.', TERMS_REQUIRED: '필수 약관에 동의해 주세요.',
  TOO_MANY_REQUESTS: '요청이 많아요. 잠시 후 다시 시도해 주세요.', TOO_MANY_ATTEMPTS: '인증 시도 횟수를 초과했어요. 새 인증번호를 받아 주세요.',
  SOCIAL_AUTH_FAILED: '카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.', RESET_TOKEN_INVALID: '재설정 링크가 만료됐거나 이미 사용됐어요.',
  AVATAR_NOT_FOUND: '선택한 아바타를 찾지 못했어요. 다시 선택해 주세요.',
  ROOM_NOT_FOUND: '선택한 메이트를 찾지 못했어요.', SESSION_NOT_FOUND: '연결 정보를 찾지 못했어요.',
  CHARACTER_NOT_IN_ROOM: '선택한 메이트와 연결할 수 없어요. 다시 선택해 주세요.',
  CHARACTER_NOT_IN_SESSION: '현재 연결 중인 메이트에게만 보낼 수 있어요.',
  ONBOARDING_REQUIRED: '프로필 설정을 완료해 주세요.', EVENT_NOT_FOUND: '상태 기록을 찾지 못했어요.',
  INVALID_EVENT: '상태 기록을 저장하지 못했어요. 다시 시도해 주세요.', EMPTY_MESSAGE: '메시지를 입력해 주세요.',
  INVALID_TARGET_MINUTES: '연결 시작에 필요한 시간 설정이 올바르지 않아요.', SESSION_ALREADY_IN_PROGRESS: '이미 진행 중인 연결이 있어요.',
  SESSION_ENDED: '이미 종료된 연결이에요. 연결 기록을 확인해 주세요.', INVALID_STUDY_TIME: '서버에서 연결 시간을 확인하지 못했어요.',
  INVALID_MEMORY: '일정 이름과 날짜를 확인해 주세요.', INVALID_DATE_RANGE: '조회 기간을 확인해 주세요.', SESSION_IN_PROGRESS: '아직 연결이 진행 중이에요.',
}

export const api = new ApiClient()
