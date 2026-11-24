import type { ExpressionRef } from '@/shared/api/types'
import type { AlivingSessionSource, SessionModelStage } from '@/features/live2d/session-model'
import { AlivingRenderer } from './AlivingRenderer'
import {
  CHAERIN_V2_LANDMARKS,
  computeCallView,
  computePointerGaze,
  modelPointToScreen,
  type AlivingView,
} from './aliving-view'
import { toV2ExpressionName } from './expression-map'
import { registerPreviewRenderer } from './preview-registry'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * The connection screen's v2 (Aliving2D) model, shaped like the legacy `Live2DStage` so `SessionModel`,
 * `Live2DFigure`, the expression director and the Picture-in-Picture window use it unchanged.
 *
 * - One renderer (one canvas, one WebGL context, one player) for the whole connection. Hosts form a stack like
 *   `Live2DStage`: the most recently attached host shows the model, so opening PiP moves the same canvas into the PiP
 *   window and closing it moves it back; nothing reloads.
 * - Camera: the card still's framing (`computeCallView`) on every host, recomputed when a host resizes.
 * - Gaze: forward by default (the call keeps the face to the user, as before). `setTracking(true)` follows the
 *   mouse/pen in the host's window.
 * - Reduced motion: no talking mouth and no cursor tracking; expressions still change (eased by the engine).
 */
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
  private destroyed = false
  private readonly motionQuery: MediaQueryList | null

  constructor(source: AlivingSessionSource) {
    this.renderer = new AlivingRenderer({
      modelUrl: source.modelUrl,
      engineUrl: source.engineUrl,
      playerUrl: source.playerUrl,
      reactionsUrl: source.reactionsUrl,
      // Supersample a little: the call tile is large, but PiP is small and hair edges alias without MSAA.
      pixelScale: 1.25,
    })
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

  subscribe = (listener: () => void) => this.renderer.subscribe(listener)
  getStatus = () => this.renderer.getStatus()

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
      this.syncTracking()
      return
    }
    this.place(host)
    this.renderer.attach(host)
    this.observer = new ResizeObserver(() => this.place(host))
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
  }

  private syncTracking() {
    const host = this.hosts.at(-1)
    const win = this.tracking && !this.reduced && host ? host.ownerDocument?.defaultView ?? null : null
    if (win === this.trackingWindow) return
    if (this.trackingWindow) {
      this.trackingWindow.removeEventListener('pointermove', this.onPointerMove)
      if (this.frame !== null) this.trackingWindow.cancelAnimationFrame(this.frame)
      this.frame = null
      this.pendingPointer = null
      this.renderer.lookAt(0, 0)
    }
    this.trackingWindow = win
    win?.addEventListener('pointermove', this.onPointerMove, { passive: true })
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
    this.pendingPointer = { x: event.clientX, y: event.clientY }
    if (this.frame === null && this.trackingWindow) this.frame = this.trackingWindow.requestAnimationFrame(this.flushGaze)
  }

  private flushGaze = () => {
    this.frame = null
    const point = this.pendingPointer
    this.pendingPointer = null
    const host = this.hosts.at(-1)
    const view = this.view
    if (!point || !host || !view) return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const face = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, rect.width, rect.height, view)
    const gaze = computePointerGaze({
      pointerX: point.x,
      pointerY: point.y,
      faceX: rect.left + face.x,
      faceY: rect.top + face.y,
      stageWidth: rect.width,
      stageHeight: rect.height,
    })
    this.renderer.lookAt(gaze.x, gaze.y)
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

  talk(ms: number) {
    if (this.reduced || !(ms > 0)) return
    this.renderer.talk(ms)
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
    this.renderer.destroy()
  }
}
