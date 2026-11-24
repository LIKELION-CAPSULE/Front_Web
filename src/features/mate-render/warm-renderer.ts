import type { PreviewMateSource } from './mate-source.ts'

/**
 * Keeps one v2 (Aliving2D) renderer warm between screens of the same page (SPA), so the next mate preview that shows
 * the same model takes it instead of loading the engine, the model and its textures again.
 *
 * - `prewarm`: home (idle, desktop only) loads the mate's model offscreen; nothing animates until a screen attaches it.
 * - `park`: a preview that unmounts (leaving 내 메이트 for 메이트 상세, React StrictMode's remount) leaves its renderer
 *   here instead of destroying it.
 * - `claim`: a preview with the same source (model, engine, player, reactions, pixel scale) takes it.
 * - One renderer at most; an unclaimed one is destroyed after `ttlMs` (WebGL context, textures, RAF), when another
 *   one is parked, and on `invalidate` (the signed-in account ended; RequireDemo calls it), after which renderers
 *   created before cannot be parked any more.
 * Dependency-free (the renderer is injected) so Node tests can drive it with fakes.
 */
export const WARM_TTL_MS = 120_000

export type AlivingSource = Extract<PreviewMateSource, { kind: 'aliving' }>

export interface WarmableRenderer {
  getStatus(): 'loading' | 'ready' | 'error'
  preload(): void
  detach(): void
  destroy(): void
  setExpression(name: string | null): void
  lookAt(x: number, y: number): void
  setTalking?(active: boolean): void
}

export function warmKey(source: AlivingSource, pixelScale = 1): string {
  return JSON.stringify([source.modelUrl, source.engineUrl, source.playerUrl, source.reactionsUrl ?? '', pixelScale])
}

export function createWarmPool<R extends WarmableRenderer>(options: {
  create: (source: AlivingSource, pixelScale: number) => R
  ttlMs?: number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}) {
  const ttlMs = options.ttlMs ?? WARM_TTL_MS
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = options.clearTimer ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>))
  let parked: { key: string; renderer: R; timer: unknown } | null = null
  /** Bumped when the signed-in account ends (logout, withdrawal, expired session); older owners may not park. */
  let generation = 0
  /** Keys a mounted preview is showing right now: prewarming them would only load a second copy. */
  const active = new Map<string, number>()

  function discard() {
    const entry = parked
    parked = null
    if (!entry) return
    clearTimer(entry.timer)
    try { entry.renderer.destroy() } catch { /* Already gone. */ }
  }

  /**
   * `owner` is the `generation()` the renderer was created (or claimed) under. A renderer from before a logout is
   * destroyed instead of parked, so a preview unmounting after the logout cannot hand the old account's model on.
   */
  function park(key: string, renderer: R, owner = generation) {
    if (parked?.renderer === renderer) return
    if (owner !== generation) {
      renderer.destroy()
      return
    }
    discard()
    if (renderer.getStatus() === 'error') {
      renderer.destroy()
      return
    }
    renderer.detach()
    // The next screen starts from the neutral face, looking at the viewer.
    renderer.setTalking?.(false)
    renderer.setExpression(null)
    renderer.lookAt(0, 0)
    const entry = { key, renderer, timer: null as unknown }
    entry.timer = setTimer(() => { if (parked === entry) discard() }, ttlMs)
    parked = entry
  }

  function claim(key: string): R | null {
    const entry = parked
    if (!entry || entry.key !== key) return null
    parked = null
    clearTimer(entry.timer)
    if (entry.renderer.getStatus() === 'error') {
      entry.renderer.destroy()
      return null
    }
    return entry.renderer
  }

  function prewarm(source: AlivingSource, pixelScale = 1): boolean {
    const key = warmKey(source, pixelScale)
    if (parked?.key === key || active.has(key)) return false
    const renderer = options.create(source, pixelScale)
    renderer.preload()
    park(key, renderer)
    return true
  }

  function markActive(key: string): () => void {
    active.set(key, (active.get(key) ?? 0) + 1)
    return () => {
      const count = (active.get(key) ?? 1) - 1
      if (count > 0) active.set(key, count)
      else active.delete(key)
    }
  }

  /** The account ended: drop the warm renderer now and refuse parks from anything created before. */
  function invalidate() {
    generation++
    discard()
  }

  return { park, claim, prewarm, discard, invalidate, generation: () => generation, markActive, parkedKey: () => parked?.key ?? null }
}

/**
 * Whether this device should spend data and GPU memory on a model nobody asked for yet: not on phones / touch-first
 * devices, not with Data Saver (`navigator.connection.saveData`), not under reduced motion (previews draw stills).
 */
export function canPrewarm(env: { matchMedia?: (query: string) => { matches: boolean }; saveData?: boolean } = browserEnv()): boolean {
  if (env.saveData) return false
  const match = env.matchMedia
  if (!match) return false
  return !match('(max-width: 767px)').matches && !match('(pointer: coarse)').matches && !match('(prefers-reduced-motion: reduce)').matches
}

function browserEnv() {
  if (typeof window === 'undefined') return {}
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return { matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined, saveData: Boolean(connection?.saveData) }
}

/** Signed-in account identity for `invalidate`: `null` when signed out. */
export function accountKey(profile: { loggedIn: boolean; userId?: number | string | null }): string | null {
  return profile.loggedIn ? `user:${profile.userId ?? ''}` : null
}

/** True when a signed-in account ended or was replaced (not when signing in from signed out). */
export function accountEnded(previous: string | null, next: string | null): boolean {
  return previous !== null && previous !== next
}
