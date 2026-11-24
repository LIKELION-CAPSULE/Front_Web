import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AlivingRenderer } from './AlivingRenderer'
import {
  CHAERIN_V2_LANDMARKS,
  computePointerGaze,
  computePreviewView,
  modelPointToScreen,
  type AlivingView,
} from './aliving-view'
import { toV2ExpressionName } from './expression-map'
import type { PreviewMateSource } from './mate-source'
import { registerPreviewRenderer } from './preview-registry'
import type { MateRenderStatus, MateRenderer } from './types'

export type AlivingPreviewStatus = MateRenderStatus | 'none'

function sourceKey(source: PreviewMateSource, scope: string, attempt: number): string {
  if (source.kind !== 'aliving') return ''
  return JSON.stringify([scope, source.modelUrl, source.engineUrl, source.playerUrl, source.reactionsUrl ?? '', attempt])
}

/**
 * Owns one v2 (Aliving2D) renderer for a mate preview stage.
 * - Camera: reproduces the hero still's framing at the host's size (`computePreviewView`), kept in sync on resize.
 * - Gaze: follows the mouse/pen across the window while `tracking` is on, otherwise looks at the viewer.
 * - Expressions: accepts legacy Cubism file names, v2 names or Korean labels (`toV2ExpressionName`).
 * - Pause: `paused` from the caller, and automatically while the stage is off screen (IntersectionObserver).
 * - Cleanup: the renderer (WebGL context, RAF, listeners) is destroyed when the source changes or the page leaves.
 */
export function useAlivingPreview({
  source,
  hostRef,
  scope,
  paused,
  tracking,
  framing,
  pixelScale,
}: {
  source: PreviewMateSource
  hostRef: RefObject<HTMLDivElement | null>
  scope: string
  paused: boolean
  tracking: boolean
  /** Camera for a stage size (layout px). Default: the hero still's framing (`computePreviewView`). */
  framing?: (width: number, height: number) => AlivingView
  /** Supersampling factor for small stages (see AlivingRenderer). */
  pixelScale?: number
}) {
  const framingRef = useRef(framing ?? computePreviewView)
  useEffect(() => {
    framingRef.current = framing ?? computePreviewView
  }, [framing])
  const [attempt, setAttempt] = useState(0)
  const key = sourceKey(source, scope, attempt)
  const [result, setResult] = useState<{ key: string; status: MateRenderStatus } | null>(null)
  const rendererRef = useRef<MateRenderer | null>(null)
  const viewRef = useRef<AlivingView | null>(null)
  const status: AlivingPreviewStatus = !key ? 'none' : result?.key === key ? result.status : 'loading'
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const host = hostRef.current
    if (!key || source.kind !== 'aliving' || !host) return
    // Layout size (a transformed host has a skewed bounding box).
    const initialView = framingRef.current(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    viewRef.current = initialView
    const renderer = new AlivingRenderer({
      modelUrl: source.modelUrl,
      engineUrl: source.engineUrl,
      playerUrl: source.playerUrl,
      reactionsUrl: source.reactionsUrl,
      initialView,
      pixelScale,
      maxPixelRatio: pixelScale && pixelScale > 1 ? 3 : 2,
    })
    rendererRef.current = renderer
    const unregister = registerPreviewRenderer(renderer)
    const unsubscribe = renderer.subscribe(() => setResult({ key, status: renderer.getStatus() }))
    renderer.attach(host)

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth
      const nextHeight = host.clientHeight
      if (nextWidth <= 0 || nextHeight <= 0) return
      const view = framingRef.current(nextWidth, nextHeight)
      viewRef.current = view
      renderer.setView(view.zoom, view.cx, view.cy)
    })
    resizeObserver.observe(host)

    return () => {
      resizeObserver.disconnect()
      unsubscribe()
      unregister()
      renderer.destroy()
      if (rendererRef.current === renderer) rendererRef.current = null
      viewRef.current = null
    }
    // `source` fields are all part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hostRef, pixelScale])

  // Off screen (scrolled away, inside a hidden view such as a list view, display: none) the model stops drawing.
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const host = hostRef.current
    if (!key || !host || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry) setOnScreen(entry.isIntersecting)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [key, hostRef])

  useEffect(() => {
    rendererRef.current?.setPaused(paused || !onScreen)
  }, [paused, onScreen, status])

  // Window-wide cursor gaze (mouse/pen only), RAF-throttled; returns to the viewer when it stops.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || status !== 'ready') return
    if (!tracking) {
      renderer.lookAt(0, 0)
      return
    }
    let frame: number | null = null
    let pending: { x: number; y: number } | null = null
    const flush = () => {
      frame = null
      const point = pending
      pending = null
      const host = hostRef.current
      const view = viewRef.current
      if (!point || !host || !view || document.hidden) return
      const rect = host.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const face = modelPointToScreen(
        CHAERIN_V2_LANDMARKS.centerX,
        CHAERIN_V2_LANDMARKS.eyesY,
        host.clientWidth || rect.width,
        host.clientHeight || rect.height,
        view,
      )
      const gaze = computePointerGaze({
        pointerX: point.x,
        pointerY: point.y,
        faceX: rect.left + face.x,
        faceY: rect.top + face.y,
        stageWidth: rect.width,
        stageHeight: rect.height,
      })
      renderer.lookAt(gaze.x, gaze.y)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      pending = { x: event.clientX, y: event.clientY }
      if (frame === null) frame = requestAnimationFrame(flush)
    }
    const reset = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      pending = null
      renderer.lookAt(0, 0)
    }
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) reset()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerout', onPointerOut)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('blur', reset)
      if (frame !== null) cancelAnimationFrame(frame)
      renderer.lookAt(0, 0)
    }
  }, [status, tracking, hostRef])

  const setExpression = useCallback((value: string | null) => {
    const name = toV2ExpressionName(value)
    // Unknown references keep the current face rather than snapping back to neutral.
    if (name === undefined) return
    rendererRef.current?.setExpression(name)
  }, [])

  return { status, retry, setExpression }
}
