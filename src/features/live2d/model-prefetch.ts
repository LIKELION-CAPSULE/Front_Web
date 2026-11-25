/**
 * Idle-time prefetch of Live2D (Cubism) model files, so picking the next avatar waits less (AvatarDial: the choices
 * either side of the current one, once its own model is on screen).
 *
 * Memory: nothing is created — no WebGL context, no Pixi texture, no model. The files are only downloaded and their
 * bodies dropped, so they sit in the browser's HTTP cache, where the real load (model3.json, moc, textures, physics)
 * finds them. Live models stay as before: at most two (one leaving, one loading/shown), textures unloaded with the last
 * user (live2d-stage.ts). At most `PREFETCH_MAX_MODELS` models per page session, one model at a time, one file at a time.
 *
 * Off on low-end devices and data saving (`canPrefetchModels`). Whether it helps depends on the files being cacheable
 * (an ETag or max-age from the server or CDN).
 */

export const PREFETCH_MAX_MODELS = 6
/** Neighbours on each side of the current choice. */
export const PREFETCH_NEIGHBOURS = 1

type Connection = { saveData?: boolean; effectiveType?: string }
type NavigatorLike = { connection?: Connection; deviceMemory?: number; hardwareConcurrency?: number }

/** Prefetching is off when data is saved, on a slow (2g) link, or with little memory (< 4 GB) or few cores (< 4). */
export function canPrefetchModels(nav: NavigatorLike | null = typeof navigator === 'undefined' ? null : navigator as NavigatorLike): boolean {
  if (!nav) return false
  const connection = nav.connection
  if (connection?.saveData) return false
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return false
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return false
  return true
}

/** The model URLs of the choices `distance` steps either side of `index` (wrapping), without the current one or repeats. */
export function prefetchTargets(urls: readonly (string | null | undefined)[], index: number, distance = PREFETCH_NEIGHBOURS): string[] {
  const count = urls.length
  if (count < 2) return []
  const current = urls[((index % count) + count) % count]
  const result: string[] = []
  for (let step = 1; step <= distance; step++) {
    for (const offset of [step, -step]) {
      const url = urls[(((index + offset) % count) + count) % count]
      if (url && url !== current && !result.includes(url)) result.push(url)
    }
  }
  return result
}

type ModelSettings = { FileReferences?: { Moc?: string; Textures?: string[]; Physics?: string; Pose?: string; DisplayInfo?: string } }

/** The files the model's first draw needs, as absolute URLs (motions and expressions load later, on use). */
export function modelFileUrls(settings: ModelSettings, modelJsonUrl: string): string[] {
  const references = settings?.FileReferences ?? {}
  const files = [references.Moc, ...(Array.isArray(references.Textures) ? references.Textures : []), references.Physics, references.Pose, references.DisplayInfo]
  const urls: string[] = []
  for (const file of files) {
    if (typeof file !== 'string' || !file) continue
    try {
      const url = new URL(file, new URL(modelJsonUrl, typeof location === 'undefined' ? 'http://localhost/' : location.href)).href
      if (!urls.includes(url)) urls.push(url)
    } catch { /* A malformed reference: skipped (the real load reports it). */ }
  }
  return urls
}

const started = new Set<string>()
let queue: Promise<void> = Promise.resolve()
const controller = { current: null as AbortController | null }

async function download(url: string, signal: AbortSignal) {
  const response = await fetch(url, { credentials: 'omit', signal })
  // The body must be read for the cache to keep it; the bytes are dropped at once.
  if (response.ok) await response.arrayBuffer()
  return response
}

async function prefetchModel(modelJsonUrl: string, signal: AbortSignal) {
  const response = await fetch(modelJsonUrl, { credentials: 'omit', signal })
  if (!response.ok) return
  const settings = await response.json() as ModelSettings
  for (const url of modelFileUrls(settings, modelJsonUrl)) {
    if (signal.aborted) return
    await download(url, signal).catch(() => undefined)
  }
}

/** Queues these models (each once per session, `PREFETCH_MAX_MODELS` in all); runs one after another. */
export function prefetchModels(urls: readonly string[]) {
  const fresh = urls.filter(url => !started.has(url)).slice(0, Math.max(0, PREFETCH_MAX_MODELS - started.size))
  if (!fresh.length) return
  controller.current ??= new AbortController()
  const signal = controller.current.signal
  for (const url of fresh) {
    started.add(url)
    queue = queue.then(() => (signal.aborted ? undefined : prefetchModel(url, signal).catch(() => undefined)))
  }
}

/** Stops what is still queued or downloading (the picker is gone). Models already fetched stay counted. */
export function cancelModelPrefetch() {
  controller.current?.abort()
  controller.current = null
}

/** Tests: forget what was started. */
export function resetModelPrefetch() {
  cancelModelPrefetch()
  started.clear()
  queue = Promise.resolve()
}

/** Runs `task` when the browser is idle (or after a short wait where idle callbacks are missing); returns a cancel. */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void })
  if (typeof idle.requestIdleCallback === 'function') {
    const id = idle.requestIdleCallback(task, { timeout })
    return () => idle.cancelIdleCallback?.(id)
  }
  const timer = setTimeout(task, 600)
  return () => clearTimeout(timer)
}
