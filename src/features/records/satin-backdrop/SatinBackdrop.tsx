/*
 * Adapted from Originkit "Satin Ribbon" (originkit.dev) — 상업 서비스 사용 허용, 재배포·판매 금지
 * (사용자 확인 2026-11-25, docs/REFERENCE_COMMERCIAL_USE.md). The renderer and the redesign: satin-renderer.ts.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { createSatinRenderer, type SatinRenderer } from './satin-renderer'
import { SATIN } from './satin-config'
import './satin-backdrop.css'

/** The first 내 기록 of this page load takes the long entrance; later visits (back from another tab) a shorter one. */
let enteredBefore = false

/**
 * 내 기록's page backdrop: slow violet satin ribbons behind the content (under the site header, which stays opaque),
 * seen through the glass blocks. Decorative only (hidden from assistive technology, never takes the pointer). Without
 * WebGL a still CSS gradient of the same colours stands in. On every entry the ribbons rise slowly out of the canvas
 * after the content (satin-config.ts `reveal`); the CSS stand-in fades in the same way; reduced motion: at once.
 */
export function SatinBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SatinRenderer | null>(null)
  const reducedMotion = useReducedMotion()
  const reducedRef = useRef(reducedMotion)
  const [fallback, setFallback] = useState(false)
  // Chosen once per mount (a remount, coming back to the tab, plays it again, shorter).
  const [reveal] = useState(() => (enteredBefore ? SATIN.reveal.again : SATIN.reveal.first))
  useEffect(() => {
    enteredBefore = true
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = createSatinRenderer(canvas, { reducedMotion: reducedRef.current, reveal })
    if (!renderer) {
      queueMicrotask(() => setFallback(true))
      return
    }
    rendererRef.current = renderer
    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [reveal])

  useEffect(() => {
    reducedRef.current = reducedMotion
    rendererRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  return (
    <div
      className="satin-backdrop"
      data-fallback={fallback || undefined}
      aria-hidden="true"
      style={{ '--satin-reveal-delay': `${reveal.delay}s`, '--satin-reveal-duration': `${reveal.duration}s` } as CSSProperties}
    >
      {!fallback && <canvas ref={canvasRef} className="satin-backdrop-canvas" />}
    </div>
  )
}
