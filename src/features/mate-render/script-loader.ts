/**
 * Loads external runtime scripts (the Aliving2D engine and player) by `<script>` tag, once per URL.
 * Engine scripts are never imported or bundled into the public repository.
 *
 * - A load that succeeds is shared by every renderer for the life of the page (the runtime is a global).
 * - A load that fails or does not finish within `timeoutMs` is forgotten: its `<script>` element is removed and the
 *   next request starts a fresh one, so a retry after a stalled request never waits on the old promise.
 * - Each caller may pass its own `AbortSignal`; aborting ends that caller's wait without cancelling the shared load
 *   for others.
 * Dependency-free (the document is injected) so Node tests can drive it with fakes.
 */

export const SCRIPT_TIMEOUT_MS = 15_000

export interface ScriptLike {
  src: string
  async: boolean
  onload: (() => void) | null
  onerror: (() => void) | null
  remove(): void
}

export interface ScriptHost {
  createScript(): ScriptLike
  append(script: ScriptLike): void
}

export class ScriptLoadError extends Error {
  readonly reason: 'error' | 'timeout' | 'aborted'
  constructor(reason: 'error' | 'timeout' | 'aborted', url: string) {
    super(
      reason === 'aborted'
        ? '엔진 스크립트 불러오기를 취소했어요.'
        : reason === 'timeout'
          ? `엔진 스크립트를 제한 시간 안에 불러오지 못했어요: ${url}`
          : `엔진 스크립트를 불러오지 못했어요: ${url}`,
    )
    this.reason = reason
  }
}

export function createScriptLoader(options: {
  host: () => ScriptHost
  timeoutMs?: number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}) {
  const timeoutMs = options.timeoutMs ?? SCRIPT_TIMEOUT_MS
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = options.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const loads = new Map<string, Promise<void>>()

  function start(url: string): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const host = options.host()
      const script = host.createScript()
      let settled = false
      const timer = setTimer(() => fail('timeout'), timeoutMs)
      function done() {
        if (settled) return
        settled = true
        clearTimer(timer)
        script.onload = null
        script.onerror = null
        resolve()
      }
      function fail(reason: 'error' | 'timeout') {
        if (settled) return
        settled = true
        clearTimer(timer)
        script.onload = null
        script.onerror = null
        script.remove()
        if (loads.get(url) === promise) loads.delete(url)
        reject(new ScriptLoadError(reason, url))
      }
      script.src = url
      script.async = false
      script.onload = done
      script.onerror = () => fail('error')
      host.append(script)
    })
    loads.set(url, promise)
    return promise
  }

  /** Resolves when `url` has run; rejects on failure, timeout, or when this caller's `signal` aborts. */
  function load(url: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new ScriptLoadError('aborted', url))
    const shared = loads.get(url) ?? start(url)
    if (!signal) return shared
    return new Promise<void>((resolve, reject) => {
      const abort = () => reject(new ScriptLoadError('aborted', url))
      signal.addEventListener('abort', abort, { once: true })
      shared.then(
        () => { signal.removeEventListener('abort', abort); resolve() },
        error => { signal.removeEventListener('abort', abort); reject(error) },
      )
    })
  }

  return { load, pending: (url: string) => loads.has(url) }
}

const browserLoader = createScriptLoader({
  host: () => ({
    createScript: () => document.createElement('script') as unknown as ScriptLike,
    append: script => document.head.append(script as unknown as HTMLScriptElement),
  }),
})

/** Page-wide loader (see `createScriptLoader`). */
export function loadScriptOnce(url: string, signal?: AbortSignal): Promise<void> {
  return browserLoader.load(url, signal)
}
