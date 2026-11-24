import type { AlivingView } from './aliving-view'
import type { MateRenderStatus, MateRenderer } from './types'
import { loadScriptOnce } from './script-loader.ts'

interface CapsuleV2ModelLike {
  background: [number, number, number, number]
  setView(zoom: number, cx: number, cy: number): void
  draw(): void
}

export interface CapsuleV2PlayerLike {
  model: CapsuleV2ModelLike
  running: boolean
  raf: number
  last: number
  frame(now: number): void
  setExpression(name: string): boolean
  playMotion(name: string): boolean
  talk(ms: number): boolean
  /** Fades the playing motion out and drops queued ones (used to end talking early). */
  stopMotion?(): void
  /** Reaction table lookup (`reactions.default.json`): expression + hold + talk for a backend trigger. */
  react?(trigger: string, intensity?: number): unknown
  lookAt(x: number, y: number): void
  setView(zoom: number, cx: number, cy: number): void
  destroy(): void
}

export interface CapsuleV2PlayerGlobal {
  create(
    canvas: HTMLCanvasElement,
    modelUrl: string,
    opts?: { reactions?: string; zoom?: number; cx?: number; cy?: number; idle?: boolean },
  ): Promise<CapsuleV2PlayerLike>
}

export { loadScriptOnce }

function getPlayerGlobal(): CapsuleV2PlayerGlobal | null {
  const w = window as unknown as { CapsuleV2Player?: CapsuleV2PlayerGlobal }
  return w.CapsuleV2Player ?? null
}

/** One `talk` motion request while talking; the next one is queued shortly before it ends. */
export const TALK_CHUNK_MS = 1_200
/** Talking never runs longer than this without a new start (a hidden tab can leave typing "on"). */
export const TALK_CAP_MS = 12_000

type WindowWithObserver = Window & { ResizeObserver?: typeof ResizeObserver }

/**
 * Aliving2D (chaerin-v2) WebGL2 renderer adapter.
 * Loads `engine.js` -> `player.js` dynamically via `<script>`, sizes the canvas with DPR <= 2,
 * clears background to transparent `[0,0,0,0]`, and pauses RAF when hidden.
 *
 * The canvas (with its WebGL context and player) is created once and moved between hosts, including into a Document
 * Picture-in-Picture window; frames, size observation and pixel-ratio changes then follow the host's window.
 */
export class AlivingRenderer implements MateRenderer {
  private readonly modelUrl: string
  private readonly engineUrl: string
  private readonly playerUrl: string
  private readonly reactionsUrl?: string
  private readonly idle: boolean
  private readonly pixelScale: number
  private readonly maxPixelRatio: number
  private readonly loadScript: (url: string, signal?: AbortSignal) => Promise<void>
  private readonly getPlayer: () => CapsuleV2PlayerGlobal | null
  private readonly listeners = new Set<() => void>()
  /** Ends this renderer's wait on shared script loads when it is destroyed. */
  private readonly bootAbort = new AbortController()

  private status: MateRenderStatus = 'loading'
  private host: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private player: CapsuleV2PlayerLike | null = null
  private view: AlivingView | null = null
  private paused = false
  private destroyed = false
  private booting = false
  private pendingExpression: string | null | undefined = undefined
  private pendingLook: { x: number; y: number } | null = null
  private onVisibilityChange: (() => void) | null = null
  private visibilityDocument: Document | null = null
  /** Window whose requestAnimationFrame drives the player (the host's window: a Document PiP window when moved). */
  private loopWindow: Window | null = null
  private pixelRatioQuery: MediaQueryList | null = null
  private talking = false
  private talkStartedAt = 0
  private talkTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: {
    modelUrl: string
    engineUrl: string
    playerUrl: string
    reactionsUrl?: string
    initialView?: AlivingView
    /** Engine idle motion toggle (default false until engine head-sway bug is fixed). */
    idle?: boolean
    /**
     * Supersampling: the canvas is drawn at devicePixelRatio × `pixelScale` (capped at `maxPixelRatio`) and the
     * browser scales it down, which smooths hair edges on small stages (the engine draws without MSAA).
     */
    pixelScale?: number
    maxPixelRatio?: number
    /** Test seams: script loading and the player global. */
    loadScript?: (url: string, signal?: AbortSignal) => Promise<void>
    getPlayer?: () => CapsuleV2PlayerGlobal | null
  }) {
    this.modelUrl = options.modelUrl
    this.engineUrl = options.engineUrl
    this.playerUrl = options.playerUrl
    this.reactionsUrl = options.reactionsUrl
    this.view = options.initialView ?? null
    this.idle = options.idle ?? false
    this.pixelScale = options.pixelScale ?? 1
    this.maxPixelRatio = options.maxPixelRatio ?? 2
    this.loadScript = options.loadScript ?? loadScriptOnce
    this.getPlayer = options.getPlayer ?? getPlayerGlobal
  }

  private setStatus(next: MateRenderStatus) {
    if (this.status === next) return
    this.status = next
    for (const listener of this.listeners) listener()
  }

  private syncCanvasSize() {
    const host = this.host
    const canvas = this.canvas
    if (!host || !canvas) return
    // Layout size, not the transformed box: a host inside a CSS 3D transform (the card lying in the my-mates scene)
    // has a skewed bounding box, and a buffer of that shape would stretch the model.
    const cssW = Math.max(1, host.clientWidth)
    const cssH = Math.max(1, host.clientHeight)
    const dpr = Math.min((this.hostWindow().devicePixelRatio || 1) * this.pixelScale, this.maxPixelRatio)
    const bufW = Math.max(1, Math.round(cssW * dpr))
    const bufH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== bufW) canvas.width = bufW
    if (canvas.height !== bufH) canvas.height = bufH
    if (this.player && this.view) {
      this.player.setView(this.view.zoom, this.view.cx, this.view.cy)
    }
  }

  private hostWindow(): Window {
    return this.host?.ownerDocument?.defaultView ?? window
  }

  /**
   * Re-sizes the buffer when the host window's pixel ratio changes (a PiP window dragged to another screen, browser
   * zoom). `(resolution: Xdppx)` matches only the current ratio, so the query is renewed after every change.
   */
  private watchPixelRatio() {
    this.unwatchPixelRatio()
    const win = this.host?.ownerDocument?.defaultView
    if (!win || typeof win.matchMedia !== 'function') return
    const query = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`)
    query.addEventListener('change', this.onPixelRatioChange)
    this.pixelRatioQuery = query
  }

  private unwatchPixelRatio() {
    this.pixelRatioQuery?.removeEventListener('change', this.onPixelRatioChange)
    this.pixelRatioQuery = null
  }

  private onPixelRatioChange = () => {
    this.syncCanvasSize()
    this.watchPixelRatio()
  }

  private stopLoop() {
    const player = this.player
    if (player?.running) {
      player.running = false
      // The player's own first loop runs on the main window; later loops on `loopWindow`.
      ;(this.loopWindow ?? window).cancelAnimationFrame(player.raf)
    }
    this.loopWindow = null
  }

  /**
   * Runs the player's frames on the host's window. A canvas moved into a Document Picture-in-Picture window keeps
   * animating there even while the original tab is hidden or throttled.
   */
  private applyPauseState() {
    const player = this.player
    if (!player || this.status === 'error') return
    const host = this.host
    const shouldPause = this.paused || !host || Boolean(host.ownerDocument?.hidden)
    if (shouldPause) {
      this.stopLoop()
      return
    }
    const win = this.hostWindow()
    if (player.running && this.loopWindow === win) return
    this.stopLoop()
    if (this.destroyed) return
    player.running = true
    player.last = performance.now()
    this.loopWindow = win
    const tick = (now: number) => {
      if (!player.running || this.destroyed || this.loopWindow !== win) return
      try {
        player.frame(now)
      } catch (error) {
        this.failRendering(error)
        return
      }
      player.raf = win.requestAnimationFrame(tick)
    }
    player.raf = win.requestAnimationFrame(tick)
  }

  /** A frame threw: stop drawing and report `error` so the screen falls back to the still image. */
  private failRendering(error: unknown) {
    console.warn('v2 모델을 그리지 못했어요.', error)
    this.stopLoop()
    this.setTalking(false)
    this.setStatus('error')
  }

  private async boot(canvas: HTMLCanvasElement) {
    const signal = this.bootAbort.signal
    try {
      await this.loadScript(this.engineUrl, signal)
      if (this.destroyed) return
      await this.loadScript(this.playerUrl, signal)
      if (this.destroyed) return

      const api = this.getPlayer()
      if (!api) throw new Error('CapsuleV2Player global not found after loading scripts')

      this.syncCanvasSize()
      const player = await api.create(canvas, this.modelUrl, {
        reactions: this.reactionsUrl,
        idle: this.idle,
        ...(this.view ? { zoom: this.view.zoom, cx: this.view.cx, cy: this.view.cy } : {}),
      })
      if (this.destroyed) {
        // Created after the renderer was dropped: stop its own loop and free it.
        player.running = false
        player.destroy()
        return
      }

      // Engine defaults to opaque white [1,1,1,1]; force transparent canvas background.
      player.model.background = [0, 0, 0, 0]
      if (this.view) {
        player.setView(this.view.zoom, this.view.cx, this.view.cy)
      }
      this.player = player

      if (this.pendingExpression !== undefined) {
        player.setExpression(this.pendingExpression ?? 'neutral')
      }
      if (this.pendingLook) {
        player.lookAt(this.pendingLook.x, this.pendingLook.y)
      }

      this.setStatus('ready')
      this.applyPauseState()
      if (this.talking) this.talkChunk()
    } catch {
      if (!this.destroyed) this.setStatus('error')
    }
  }

  /**
   * Shows the model in `host`. The canvas (and its WebGL context and player) is created once and moved between hosts,
   * including into another document (Document PiP), so a move never reloads the model.
   */
  attach(host: HTMLElement): void {
    if (this.destroyed) return
    if (this.host === host && this.canvas?.parentElement === host) return
    this.detach()
    this.host = host

    const canvas = this.ensureCanvas()
    host.append(canvas)

    this.syncCanvasSize()
    // The observer comes from the host's window: one from the original tab stops reporting a PiP window's resizes
    // while that tab is hidden.
    const Observer = (host.ownerDocument?.defaultView as WindowWithObserver | null)?.ResizeObserver ?? ResizeObserver
    this.resizeObserver = new Observer(() => this.syncCanvasSize())
    this.resizeObserver.observe(host)
    this.watchPixelRatio()

    const doc = host.ownerDocument ?? document
    this.onVisibilityChange = () => this.applyPauseState()
    this.visibilityDocument = doc
    doc.addEventListener('visibilitychange', this.onVisibilityChange)

    if (!this.player) {
      this.startBoot(canvas)
    } else {
      this.applyPauseState()
      // A moved or resized buffer is blank until the next frame: draw at once.
      try { this.player.model.draw() } catch { /* Drawn on the next frame. */ }
    }
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (this.canvas) return this.canvas
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.background = 'transparent'
    canvas.setAttribute('aria-hidden', 'true')
    this.canvas = canvas
    return canvas
  }

  private startBoot(canvas: HTMLCanvasElement) {
    if (this.booting || this.player || this.destroyed) return
    this.booting = true
    void this.boot(canvas)
  }

  /**
   * Loads the engine and model before any host exists (the connection prepares the model before the call screen
   * mounts). The canvas stays offscreen and does not animate until `attach`.
   */
  preload(): void {
    if (this.destroyed) return
    this.startBoot(this.ensureCanvas())
  }

  /** Takes the canvas out of its host and stops drawing; the model stays loaded for the next `attach`. */
  detach(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.unwatchPixelRatio()
    if (this.onVisibilityChange) {
      this.visibilityDocument?.removeEventListener('visibilitychange', this.onVisibilityChange)
      this.onVisibilityChange = null
      this.visibilityDocument = null
    }
    this.canvas?.remove()
    this.host = null
    this.stopLoop()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.bootAbort.abort()
    this.setTalking(false)
    // Stop the loop while the player (and the window its frame was requested on) is still known.
    this.stopLoop()
    this.detach()
    const player = this.player
    this.player = null
    try {
      player?.destroy()
    } catch {
      // Already torn down.
    }
    if (this.canvas) {
      try {
        this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // Ignore if context is already lost
      }
    }
    this.canvas = null
    this.listeners.clear()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getStatus(): MateRenderStatus {
    return this.status
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.applyPauseState()
  }

  lookAt(x: number, y: number): void {
    this.pendingLook = { x, y }
    this.player?.lookAt(x, y)
  }

  setExpression(name: string | null): void {
    this.pendingExpression = name
    this.player?.setExpression(name ?? 'neutral')
  }

  talk(ms: number): void {
    if (ms > 0) this.player?.talk(ms)
  }

  /**
   * Moves the mouth for as long as a line is being shown: on while text types, off when it finishes, is skipped or
   * cancelled. Talking runs as short queued `talk` chunks, so turning it off (or the cap) ends it within a chunk.
   */
  setTalking(active: boolean): void {
    if (this.destroyed && active) return
    if (active === this.talking) {
      // A new line while talking restarts the cap.
      if (active) this.talkStartedAt = performance.now()
      return
    }
    this.talking = active
    clearTimeout(this.talkTimer)
    this.talkTimer = undefined
    if (active) {
      this.talkStartedAt = performance.now()
      this.talkChunk()
    } else {
      try { this.player?.stopMotion?.() } catch { /* The motion ends on its own. */ }
    }
  }

  isTalking(): boolean {
    return this.talking
  }

  private talkChunk() {
    clearTimeout(this.talkTimer)
    this.talkTimer = undefined
    if (!this.talking || this.destroyed) return
    if (performance.now() - this.talkStartedAt >= TALK_CAP_MS) {
      this.talking = false
      return
    }
    // Before the model is ready the timer keeps time; the first chunk plays once the player exists.
    if (this.status !== 'error') this.player?.talk(TALK_CHUNK_MS)
    this.talkTimer = setTimeout(() => this.talkChunk(), TALK_CHUNK_MS - 150)
  }

  /** Plays a reaction from the reaction table; false when the player has no table or no matching trigger. */
  react(trigger: string, intensity = 1): boolean {
    const player = this.player
    if (!player?.react || !this.reactionsUrl) return false
    try {
      return player.react(trigger, intensity) !== false
    } catch {
      return false
    }
  }

  setView(zoom: number, cx: number, cy: number): void {
    this.view = { zoom, cx, cy }
    this.player?.setView(zoom, cx, cy)
  }
}
