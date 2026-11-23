import type { AlivingView } from './aliving-view'
import type { MateRenderStatus, MateRenderer } from './types'

interface CapsuleV2ModelLike {
  background: [number, number, number, number]
  setView(zoom: number, cx: number, cy: number): void
  draw(): void
}

interface CapsuleV2PlayerLike {
  model: CapsuleV2ModelLike
  running: boolean
  raf: number
  last: number
  frame(now: number): void
  setExpression(name: string): boolean
  playMotion(name: string): boolean
  talk(ms: number): boolean
  lookAt(x: number, y: number): void
  setView(zoom: number, cx: number, cy: number): void
  destroy(): void
}

interface CapsuleV2PlayerGlobal {
  create(
    canvas: HTMLCanvasElement,
    modelUrl: string,
    opts?: { reactions?: string; zoom?: number; cx?: number; cy?: number; idle?: boolean },
  ): Promise<CapsuleV2PlayerLike>
}

const scriptPromises = new Map<string, Promise<void>>()

/**
 * Loads an external runtime script once per URL via `<script>` tag.
 * Engine scripts are never imported or bundled into the public repository.
 */
export function loadScriptOnce(url: string): Promise<void> {
  const existing = scriptPromises.get(url)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromises.delete(url)
      script.remove()
      reject(new Error(`엔진 스크립트를 불러오지 못했어요: ${url}`))
    }
    document.head.append(script)
  })
  scriptPromises.set(url, promise)
  return promise
}

function getPlayerGlobal(): CapsuleV2PlayerGlobal | null {
  const w = window as unknown as { CapsuleV2Player?: CapsuleV2PlayerGlobal }
  return w.CapsuleV2Player ?? null
}

/**
 * Aliving2D (chaerin-v2) WebGL2 renderer adapter.
 * Loads `engine.js` -> `player.js` dynamically via `<script>`, sizes the canvas with DPR <= 2,
 * clears background to transparent `[0,0,0,0]`, and pauses RAF when hidden.
 */
export class AlivingRenderer implements MateRenderer {
  private readonly modelUrl: string
  private readonly engineUrl: string
  private readonly playerUrl: string
  private readonly reactionsUrl?: string
  private readonly idle: boolean
  private readonly listeners = new Set<() => void>()

  private status: MateRenderStatus = 'loading'
  private host: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private player: CapsuleV2PlayerLike | null = null
  private view: AlivingView | null = null
  private paused = false
  private destroyed = false
  private pendingExpression: string | null | undefined = undefined
  private pendingLook: { x: number; y: number } | null = null
  private onVisibilityChange: (() => void) | null = null

  constructor(options: {
    modelUrl: string
    engineUrl: string
    playerUrl: string
    reactionsUrl?: string
    initialView?: AlivingView
    /** Engine idle motion toggle (default false until engine head-sway bug is fixed). */
    idle?: boolean
  }) {
    this.modelUrl = options.modelUrl
    this.engineUrl = options.engineUrl
    this.playerUrl = options.playerUrl
    this.reactionsUrl = options.reactionsUrl
    this.view = options.initialView ?? null
    this.idle = options.idle ?? false
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
    const rect = host.getBoundingClientRect()
    const cssW = Math.max(1, Math.round(rect.width))
    const cssH = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const bufW = Math.max(1, Math.round(cssW * dpr))
    const bufH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== bufW) canvas.width = bufW
    if (canvas.height !== bufH) canvas.height = bufH
    if (this.player && this.view) {
      this.player.setView(this.view.zoom, this.view.cx, this.view.cy)
    }
  }

  private applyPauseState() {
    const player = this.player
    if (!player) return
    const shouldPause = this.paused || document.hidden
    if (shouldPause) {
      if (player.running) {
        player.running = false
        cancelAnimationFrame(player.raf)
      }
      return
    }
    if (!player.running && !this.destroyed) {
      player.running = true
      player.last = performance.now()
      const tick = (now: number) => {
        if (!player.running || this.destroyed) return
        player.frame(now)
        player.raf = requestAnimationFrame(tick)
      }
      player.raf = requestAnimationFrame(tick)
    }
  }

  private async boot(canvas: HTMLCanvasElement) {
    try {
      await loadScriptOnce(this.engineUrl)
      if (this.destroyed) return
      await loadScriptOnce(this.playerUrl)
      if (this.destroyed) return

      const api = getPlayerGlobal()
      if (!api) throw new Error('CapsuleV2Player global not found after loading scripts')

      this.syncCanvasSize()
      const player = await api.create(canvas, this.modelUrl, {
        reactions: this.reactionsUrl,
        idle: this.idle,
        ...(this.view ? { zoom: this.view.zoom, cx: this.view.cx, cy: this.view.cy } : {}),
      })
      if (this.destroyed) {
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

      this.applyPauseState()
      this.setStatus('ready')
    } catch {
      if (!this.destroyed) this.setStatus('error')
    }
  }

  attach(host: HTMLElement): void {
    if (this.destroyed) return
    this.detach()
    this.host = host

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.background = 'transparent'
    canvas.setAttribute('aria-hidden', 'true')
    host.append(canvas)
    this.canvas = canvas

    this.syncCanvasSize()
    this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize())
    this.resizeObserver.observe(host)

    this.onVisibilityChange = () => this.applyPauseState()
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    if (!this.player) {
      void this.boot(canvas)
    }
  }

  detach(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
      this.onVisibilityChange = null
    }
    this.canvas?.remove()
    this.canvas = null
    this.host = null
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.player?.destroy()
    this.player = null
    if (this.canvas) {
      try {
        this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // Ignore if context is already lost
      }
    }
    this.detach()
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

  setView(zoom: number, cx: number, cy: number): void {
    this.view = { zoom, cx, cy }
    this.player?.setView(zoom, cx, cy)
  }
}
