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

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal }
/** `events`: the reply was an event stream and every event was delivered. `json`: the server answered with plain JSON. */
export type StreamResult<T> = { type: 'events' } | { type: 'json'; data: T }

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
  /** Parses a JSON reply, throwing `ApiError` for error statuses. */
  private async read<T>(response: Response, options: Options): Promise<T> {
    const raw = await response.text()
    let data: unknown = null
    try { data = raw ? JSON.parse(raw) : null } catch { /* Error pages can be HTML. */ }
    if (!response.ok) throw toApiError(response.status, data)
    if (raw && data === null) throw new ApiError('서버 응답 형식을 확인하지 못했어요.', 502)
    // A read started before a successful write must not serve as the write's follow-up read.
    if (!['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase())) this.reads.clear()
    return data as T
  }
}

/** Builds the user-facing error for an error body (`{ code, message, detail }`) and status. */
export function toApiError(status: number, data: unknown) {
  const body = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error :
    status === 401 ? '로그인이 필요해요.' : status === 403 ? '접근할 수 없어요.' :
    status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : `요청을 처리하지 못했어요. (${status})`
  const code = typeof body.code === 'string' ? body.code : undefined
  const detail = body.detail && typeof body.detail === 'object' ? body.detail as Record<string, unknown> : {}
  return new ApiError(code && errorMessages[code] ? errorMessages[code] : message, status, code, detail)
}

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.', LOGIN_LOCKED: '로그인을 여러 번 실패했어요. 5분 뒤 다시 시도해 주세요.',
  INVALID_EMAIL: '이메일 주소를 확인해 주세요.', EMAIL_ALREADY_USED: '이미 가입한 이메일이에요.', INVALID_PASSWORD: '비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.',
  INVALID_NICKNAME: '닉네임은 1~20자로 입력해 주세요.', INVALID_CODE: '인증번호가 올바르지 않아요.', CODE_EXPIRED: '인증번호의 유효 시간이 지났어요.',
  VERIFICATION_EXPIRED: '이메일 인증이 만료됐어요. 인증번호를 다시 받아 주세요.', TERMS_REQUIRED: '필수 약관에 동의해 주세요.',
  TOO_MANY_REQUESTS: '요청이 많아요. 잠시 후 다시 시도해 주세요.', TOO_MANY_ATTEMPTS: '인증 시도 횟수를 초과했어요. 새 인증번호를 받아 주세요.',
  INVALID_TARGET_MINUTES: '서버에서 이 목표 시간을 허용하지 않아요.', SESSION_ALREADY_IN_PROGRESS: '이미 진행 중인 공부가 있어요.',
  SESSION_ENDED: '이미 종료된 공부예요. 리포트를 확인해 주세요.', INVALID_STUDY_TIME: '서버에서 공부 시간을 확인하지 못했어요.',
  INVALID_MEMORY: '일정 이름과 날짜를 확인해 주세요.', SESSION_IN_PROGRESS: '아직 공부가 진행 중이에요.',
}

export const api = new ApiClient()
