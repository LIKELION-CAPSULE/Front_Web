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

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal }

/** Access tokens stay in memory; refresh is serialized and uses an HttpOnly cookie. */
export class ApiClient {
  private token: string | null = null
  private refreshTask: Promise<boolean> | null = null
  private generation = 0
  private expired: (() => void) | null = null
  private readonly reads = new Map<string, Promise<unknown>>()
  private readonly transport: typeof fetch
  private readonly base: string
  constructor(transport: typeof fetch = globalThis.fetch.bind(globalThis), base = '/api/backend') {
    this.transport = transport
    this.base = base
  }
  setToken(token: string | null) { this.token = token; this.generation++; this.reads.clear() }
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
        this.setToken(data.accessToken)
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
  private async perform<T>(path: string, options: Options, retry: boolean): Promise<T> {
    const token = this.token
    const headers: Record<string, string> = { accept: 'application/json' }
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
      if (retry && ((this.token && this.token !== token) || await this.refresh())) return this.request<T>(path, options, false)
      this.setToken(null)
      this.expired?.()
    }
    const raw = await response.text()
    let data: unknown = null
    try { data = raw ? JSON.parse(raw) : null } catch { /* Error pages can be HTML. */ }
    if (!response.ok) {
      const body = data && typeof data === 'object' ? data as Record<string, unknown> : {}
      const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error :
        response.status === 401 ? '로그인이 필요해요.' : response.status === 403 ? '접근할 수 없어요.' :
        response.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : `요청을 처리하지 못했어요. (${response.status})`
      const code = typeof body.code === 'string' ? body.code : undefined
      const messages: Record<string, string> = {
        INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.', LOGIN_LOCKED: '로그인을 여러 번 실패했어요. 5분 뒤 다시 시도해 주세요.',
        INVALID_EMAIL: '이메일 주소를 확인해 주세요.', EMAIL_ALREADY_USED: '이미 가입한 이메일이에요.', INVALID_PASSWORD: '비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.',
        INVALID_NICKNAME: '닉네임은 1~20자로 입력해 주세요.', INVALID_CODE: '인증번호가 올바르지 않아요.', CODE_EXPIRED: '인증번호의 유효 시간이 지났어요.',
        VERIFICATION_EXPIRED: '이메일 인증이 만료됐어요. 인증번호를 다시 받아 주세요.', TERMS_REQUIRED: '필수 약관에 동의해 주세요.',
        TOO_MANY_REQUESTS: '요청이 많아요. 잠시 후 다시 시도해 주세요.', TOO_MANY_ATTEMPTS: '인증 시도 횟수를 초과했어요. 새 인증번호를 받아 주세요.',
        INVALID_TARGET_MINUTES: '서버에서 이 목표 시간을 허용하지 않아요.', SESSION_ALREADY_IN_PROGRESS: '이미 진행 중인 공부가 있어요.',
        SESSION_ENDED: '이미 종료된 공부예요. 리포트를 확인해 주세요.', INVALID_STUDY_TIME: '서버에서 공부 시간을 확인하지 못했어요.',
        INVALID_MEMORY: '일정 이름과 날짜를 확인해 주세요.', SESSION_IN_PROGRESS: '아직 공부가 진행 중이에요.',
      }
      const detail = body.detail && typeof body.detail === 'object' ? body.detail as Record<string, unknown> : {}
      throw new ApiError(code && messages[code] ? messages[code] : message, response.status, code, detail)
    }
    if (raw && data === null) throw new ApiError('서버 응답 형식을 확인하지 못했어요.', 502)
    // A read started before a successful write must not serve as the write's follow-up read.
    if (!['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase())) this.reads.clear()
    return data as T
  }
}

export const api = new ApiClient()
