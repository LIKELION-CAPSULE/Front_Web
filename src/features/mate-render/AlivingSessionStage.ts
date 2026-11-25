import type { ExpressionRef } from '@/shared/api/types'
import type { AlivingSessionSource, SessionModelStage } from '@/features/live2d/session-model'
import { AlivingRenderer, type CapsuleV2PlayerGlobal } from './AlivingRenderer.ts'
import type { MateRenderStatus } from './types'
import {
  CHAERIN_V2_LANDMARKS,
  computeCallView,
  computePointerGaze,
  modelPointToScreen,
  type AlivingView,
} from './aliving-view.ts'
import { toV2ExpressionName } from './expression-map.ts'
import { registerPreviewRenderer } from './preview-registry.ts'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

type WindowWithObserver = Window & { ResizeObserver?: typeof ResizeObserver }

export interface AlivingSessionStageOptions {
  /** Still image shown in the host if the live model breaks after it was ready (the card still, head → chest). */
  stillImage?: string
  /** Test seams passed to the renderer. */
  loadScript?: (url: string, signal?: AbortSignal) => Promise<void>
  getPlayer?: () => CapsuleV2PlayerGlobal | null
}

/**
 * The connection screen's v2 (Aliving2D) model, shaped like the legacy `Live2DStage` so `SessionModel`,
 * `Live2DFigure`, the expression director and the Picture-in-Picture window use it unchanged.
 *
 * - One renderer (one canvas, one WebGL context, one player) for the whole connection. Hosts form a stack like
 *   `Live2DStage`: the most recently attached host shows the model, so opening PiP moves the same canvas into the PiP
 *   window and closing it moves it back; nothing reloads.
 * - Camera: the card still's framing (`computeCallView`) on every host, recomputed when a host resizes.
 * - Gaze: forward by default. `setTracking(true)` (the 「시선 따라오기」 setting, T-10) follows the mouse/pen in the
 *   host's window — the call tab, or the PiP window once the canvas moves there — eased (no snapping), kept within a
 *   modest turn, and easing back to the front when the pointer rests for a while or leaves the window. Only the gaze
 *   (head/eye look target) moves; expressions, talking and reactions keep their own channels.
 * - Reduced motion: no talking mouth and no cursor tracking; expressions still change (eased by the engine).
 * - Failure: an error before the model is ready reports `error` (SessionModel then continues with the still image);
 *   a render error after that keeps the stage `ready` and swaps the canvas for `stillImage` in whichever host shows
 *   it (the call tile or the PiP window), so the screen never goes blank.
 */
/** Gaze following (T-10): the most it turns (of the engine's ±1), how fast it eases (per second), when it rests. */
const GAZE_LIMIT = 0.75
const GAZE_EASE = 5
const GAZE_REST_MS = 3500
/** The nod of a tap: how long and how far down (of the engine's ±1). */
const NOD_MS = 600
const NOD_DEPTH = 0.22

export class AlivingSessionStage implements SessionModelStage {
  private readonly renderer: AlivingRenderer
  private readonly unregister: () => void
  private hosts: HTMLElement[] = []
  private observer: ResizeObserver | null = null
  private view: AlivingView | null = null
  private tracking = false
  private trackingWindow: Window | null = null
  private frame: number | null = null
  private pendingPointer: { x: number; y: number } | null = null
  /** Eased gaze: where it is, where it is heading, and when the pointer last moved. */
  private gaze = { x: 0, y: 0 }
  private gazeTarget = { x: 0, y: 0 }
  private lastPointerAt = 0
  private lastGazeFrame = 0
  /** A nod in progress (a tap on the mate): when it started. It rides on the gaze, so it never fights the tracking. */
  private nodAt = -Infinity
  private destroyed = false
  private readonly motionQuery: MediaQueryList | null
  private readonly listeners = new Set<() => void>()
  private status: MateRenderStatus = 'loading'
  /** The live model broke after it was ready: the still image stands in. */
  private degraded = false
  private still: HTMLImageElement | null = null
  private readonly stillImage?: string
  private talkingRequested = false

  constructor(source: AlivingSessionSource, options: AlivingSessionStageOptions = {}) {
    this.stillImage = options.stillImage
    this.renderer = new AlivingRenderer({
      modelUrl: source.modelUrl,
      engineUrl: source.engineUrl,
      playerUrl: source.playerUrl,
      reactionsUrl: source.reactionsUrl,
      // Supersample a little: the call tile is large, but PiP is small and hair edges alias without MSAA.
      pixelScale: 1.25,
      loadScript: options.loadScript,
      getPlayer: options.getPlayer,
    })
    this.renderer.subscribe(this.onRendererStatus)
    this.renderer.lookAt(0, 0)
    // Load now, like Live2DStage: SessionModel waits for 'ready' before the call screen gives the stage a host.
    this.renderer.preload()
    // The local dummy tool's expression picker reaches the session model through the same registry as previews.
    this.unregister = registerPreviewRenderer({ setExpression: name => this.renderer.setExpression(name) })
    this.motionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null
    this.motionQuery?.addEventListener('change', this.onMotionChange)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getStatus = () => this.status

  private setStatus(next: MateRenderStatus) {
    if (this.status === next) return
    this.status = next
    for (const listener of this.listeners) listener()
  }

  private onRendererStatus = () => {
    const next = this.renderer.getStatus()
    if (next === 'error' && this.status === 'ready') {
      this.degraded = true
      this.mount()
      return
    }
    this.setStatus(next)
  }

  /** Whether the still image stands in for a live model that broke after it was ready. */
  isDegraded() {
    return this.degraded
  }

  private showStill(host: HTMLElement) {
    if (!this.stillImage) return
    const doc = host.ownerDocument ?? document
    if (!this.still || this.still.ownerDocument !== doc) {
      this.still?.remove()
      const img = doc.createElement('img')
      img.src = this.stillImage
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      img.dataset.mateStill = 'true'
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block'
      this.still = img
    }
    if (this.still.parentElement !== host) host.append(this.still)
  }

  private get reduced() {
    return Boolean(this.motionQuery?.matches)
  }

  attach(host: HTMLElement) {
    if (this.destroyed) return
    this.hosts = [...this.hosts.filter(value => value !== host), host]
    this.mount()
  }

  detach(host: HTMLElement) {
    this.hosts = this.hosts.filter(value => value !== host)
    this.mount()
  }

  private mount() {
    const host = this.hosts.at(-1)
    this.observer?.disconnect()
    this.observer = null
    if (!host) {
      this.renderer.detach()
      this.still?.remove()
      this.syncTracking()
      return
    }
    if (this.degraded) {
      this.renderer.detach()
      this.showStill(host)
      this.syncTracking()
      return
    }
    this.place(host)
    this.renderer.attach(host)
    // From the host's own window, so a PiP window keeps reporting resizes while the original tab is hidden.
    const Observer = (host.ownerDocument?.defaultView as WindowWithObserver | null)?.ResizeObserver ?? ResizeObserver
    this.observer = new Observer(() => this.place(host))
    this.observer.observe(host)
    this.syncTracking()
  }

  private place(host: HTMLElement) {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    const view = computeCallView(width, height)
    this.view = view
    this.renderer.setView(view.zoom, view.cx, view.cy)
  }

  setTracking(enabled: boolean) {
    this.tracking = enabled
    this.syncTracking()
  }

  private onMotionChange = () => {
    this.syncTracking()
    this.syncTalking()
  }

  private syncTracking() {
    const host = this.hosts.at(-1)
    const win = this.tracking && !this.reduced && !this.degraded && host ? host.ownerDocument?.defaultView ?? null : null
    if (win === this.trackingWindow) return
    if (this.trackingWindow) {
      this.trackingWindow.removeEventListener('pointermove', this.onPointerMove)
      this.trackingWindow.document.removeEventListener('mouseout', this.onPointerOut)
      if (this.frame !== null) (this.frameWindow ?? this.trackingWindow).cancelAnimationFrame(this.frame)
      this.frame = null
      this.pendingPointer = null
      this.gaze = { x: 0, y: 0 }
      this.gazeTarget = { x: 0, y: 0 }
      this.renderer.lookAt(0, 0)
    }
    this.trackingWindow = win
    win?.addEventListener('pointermove', this.onPointerMove, { passive: true })
    win?.document.addEventListener('mouseout', this.onPointerOut)
  }

  /** The pointer left the window: ease back to the front. */
  private onPointerOut = (event: MouseEvent) => {
    if (event.relatedTarget) return
    this.pendingPointer = null
    this.gazeTarget = { x: 0, y: 0 }
    this.scheduleGaze()
  }

  private scheduleGaze() {
    const win = this.trackingWindow ?? this.hosts.at(-1)?.ownerDocument?.defaultView ?? null
    if (this.frame === null && win) {
      this.frameWindow = win
      this.frame = win.requestAnimationFrame(this.flushGaze)
    }
  }
  private frameWindow: Window | null = null

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
    this.pendingPointer = { x: event.clientX, y: event.clientY }
    this.lastPointerAt = performance.now()
    this.scheduleGaze()
  }

  private flushGaze = (at: number) => {
    this.frame = null
    const point = this.pendingPointer
    this.pendingPointer = null
    const host = this.hosts.at(-1)
    const view = this.view
    if (point && host && view) {
      const rect = host.getBoundingClientRect()
      if (rect.width && rect.height) {
        const face = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, rect.width, rect.height, view)
        const target = computePointerGaze({
          pointerX: point.x,
          pointerY: point.y,
          faceX: rect.left + face.x,
          faceY: rect.top + face.y,
          stageWidth: rect.width,
          stageHeight: rect.height,
        })
        // A modest turn at most: the face stays towards the user.
        this.gazeTarget = { x: Math.max(-GAZE_LIMIT, Math.min(GAZE_LIMIT, target.x)), y: Math.max(-GAZE_LIMIT, Math.min(GAZE_LIMIT, target.y)) }
      }
    }
    // Resting pointer: back to the front, slowly.
    if (at - this.lastPointerAt > GAZE_REST_MS) this.gazeTarget = { x: 0, y: 0 }
    const dt = this.lastGazeFrame ? Math.min(0.1, (at - this.lastGazeFrame) / 1000) : 1 / 60
    this.lastGazeFrame = at
    const ease = 1 - Math.exp(-GAZE_EASE * dt)
    this.gaze = { x: this.gaze.x + (this.gazeTarget.x - this.gaze.x) * ease, y: this.gaze.y + (this.gazeTarget.y - this.gaze.y) * ease }
    const nodding = at - this.nodAt < NOD_MS
    // The nod: down and back once, on top of wherever she looks.
    const nod = nodding ? -NOD_DEPTH * Math.sin((Math.PI * (at - this.nodAt)) / NOD_MS) : 0
    this.renderer.lookAt(this.gaze.x, this.gaze.y + nod)
    const settled = !nodding && Math.abs(this.gazeTarget.x - this.gaze.x) < 0.002 && Math.abs(this.gazeTarget.y - this.gaze.y) < 0.002
    const resting = this.gazeTarget.x === 0 && this.gazeTarget.y === 0
    // Keep easing until settled; while the pointer is off the front, wake once more when the rest time is up.
    if (!settled || (!resting && this.trackingWindow)) this.scheduleGaze()
    else this.lastGazeFrame = 0
  }

  /** A small nod (a tap on the mate). Not under reduced motion. */
  nudge() {
    if (this.reduced || this.degraded || this.destroyed) return
    this.nodAt = performance.now()
    this.scheduleGaze()
  }

  /** Accepts a v2 name, a Korean label or a legacy Cubism file; unknown references keep the current face. */
  setExpression(key: string | null) {
    const name = toV2ExpressionName(key)
    if (name === undefined) return
    this.renderer.setExpression(name)
  }

  expressionKey(expression: ExpressionRef | null | undefined): string | null {
    return toV2ExpressionName(expression?.file) ?? toV2ExpressionName(expression?.name) ?? null
  }

  /** Mouth movement while a line types on screen (chat reply or event bubble); off under reduced motion. */
  setTalking(active: boolean) {
    this.talkingRequested = active
    this.syncTalking()
  }

  private syncTalking() {
    this.renderer.setTalking(this.talkingRequested && !this.reduced && !this.degraded && !this.destroyed)
  }

  react(trigger: string, intensity = 1) {
    return this.renderer.react(trigger, intensity)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.tracking = false
    this.hosts = []
    this.syncTracking()
    this.observer?.disconnect()
    this.observer = null
    this.motionQuery?.removeEventListener('change', this.onMotionChange)
    this.unregister()
    this.still?.remove()
    this.still = null
    this.renderer.destroy()
    this.listeners.clear()
  }
}
