/*
 * Adapted from Originkit "Satin Ribbon" (originkit.dev) — 상업 서비스 사용 허용, 재배포·판매 금지
 * (사용자 확인 2026-11-25, docs/REFERENCE_COMMERCIAL_USE.md). The renderer and the redesign: satin-renderer.ts.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { createSatinRenderer, type SatinRenderer } from './satin-renderer'
import './satin-backdrop.css'

/**
 * 내 기록's page backdrop: slow violet satin ribbons behind the content (under the site header, which stays opaque),
 * seen through the glass blocks. Decorative only (hidden from assistive technology, never takes the pointer). Without
 * WebGL a still CSS gradient of the same colours stands in.
 */
export function SatinBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SatinRenderer | null>(null)
  const reducedMotion = useReducedMotion()
  const reducedRef = useRef(reducedMotion)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = createSatinRenderer(canvas, { reducedMotion: reducedRef.current })
    if (!renderer) {
      queueMicrotask(() => setFallback(true))
      return
    }
    rendererRef.current = renderer
    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    reducedRef.current = reducedMotion
    rendererRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  return (
    <div className="satin-backdrop" data-fallback={fallback || undefined} aria-hidden="true">
      {!fallback && <canvas ref={canvasRef} className="satin-backdrop-canvas" />}
    </div>
  )
}
