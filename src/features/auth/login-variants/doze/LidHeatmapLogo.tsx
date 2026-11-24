import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Heatmap } from '@paper-design/shaders-react'
import type { PaperShaderElement } from '@paper-design/shaders'

/**
 * Heat flowing inside the capsule of the CAPSULE logo on the laptop lid, like warm metal (Paper Shaders `Heatmap`,
 * Apache-2.0, see docs/THIRD_PARTY_NOTICES.md). Loaded lazily by DozeDesk only when the live (Live2D) path runs;
 * reduced motion, no WebGL and the still path keep the static logo and never load this module.
 *
 * - Colours: logo v2 violet ramp only (no heatmap blue / orange / red).
 * - It is light added on top of the static logo (DozeDesk keeps that logo as it was and screens this over it, masked
 *   to the capsule), so the logo always reads; the input silhouette is the capsule glyph, not the whole tile.
 * - The shader parameters stay fixed per state (changing them re-uploads the image); the 0.9 s brighten on waking is
 *   CSS (opacity, brightness, drop-shadow), timed with the rest of the laptop light.
 * - Canvas = this box only, at most 2 device px per CSS px (`maxPixelCount`); the mount pauses itself while the tab is
 *   hidden or the box is off screen, and `dispose()` (on unmount) releases the WebGL context.
 * - The mount has no context-loss handling and throws without WebGL2: both fall back to the static logo here.
 */

/** Low heat is transparent (no box around the logo), then the logo v2 violets up to a faint white. */
export const LID_HEATMAP_COLORS = ['#8053F200', '#8053F2', '#A98BF6', '#D4C3FA', '#F6F1FF'] as const

/** Dozing: dim and slow ("the laptop is on"). Awake: a little livelier; brightness itself is CSS. */
const HEATMAP_PARAMS = {
  dozing: { speed: 0.22 },
  awake: { speed: 0.45 },
  shared: { contour: 0.5, angle: 0, noise: 0.05, innerGlow: 0.6, outerGlow: 0 },
} as const

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

class ShaderBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function HeatmapCanvas({
  awake,
  silhouette,
  width,
  height,
  scale,
  onReady,
  onFail,
}: {
  awake: boolean
  silhouette: string
  width: number
  height: number
  scale: number
  onReady: () => void
  onFail: () => void
}) {
  const hostRef = useRef<PaperShaderElement>(null)
  const onReadyRef = useRef(onReady)
  const onFailRef = useRef(onFail)
  useEffect(() => {
    onReadyRef.current = onReady
    onFailRef.current = onFail
  }, [onReady, onFail])

  // Context lost (GPU reset, too many contexts): hand back to the static logo. The listener is removed before the
  // mount's own dispose() loses the context on unmount.
  // The mount (and its canvas) is created asynchronously after the silhouette is processed, so look for the canvas a
  // moment later; if none shows up, give up quietly.
  useEffect(() => {
    let canvas: HTMLCanvasElement | null = null
    let tries = 0
    let timer = 0
    const lost = (event: Event) => {
      event.preventDefault()
      onFailRef.current()
    }
    const check = () => {
      canvas = hostRef.current?.querySelector('canvas') ?? null
      if (canvas) {
        canvas.addEventListener('webglcontextlost', lost)
        onReadyRef.current()
        return
      }
      if (++tries > 20) onFailRef.current()
      else timer = window.setTimeout(check, 150)
    }
    timer = window.setTimeout(check, 450)
    return () => {
      window.clearTimeout(timer)
      canvas?.removeEventListener('webglcontextlost', lost)
    }
  }, [])

  const params = awake ? HEATMAP_PARAMS.awake : HEATMAP_PARAMS.dozing
  return (
    <Heatmap
      ref={hostRef}
      className="doze-heatmap-canvas"
      width={width}
      height={height}
      image={silhouette}
      colors={[...LID_HEATMAP_COLORS]}
      colorBack="#00000000"
      speed={params.speed}
      {...HEATMAP_PARAMS.shared}
      fit="contain"
      scale={scale}
      minPixelRatio={2}
      maxPixelCount={Math.ceil(width * height * 4)}
    />
  )
}

export default function LidHeatmapLogo({
  awake,
  silhouette,
  width,
  height,
  scale,
  onActiveChange,
}: {
  awake: boolean
  /** Dark-on-transparent image whose shape the heat flows in (an image URL). */
  silhouette: string
  /** CSS px of the shader box (the shape plus room around it). */
  width: number
  height: number
  /** Shrinks the silhouette inside the box (1 = fills it). */
  scale: number
  /** True once the shader draws the logo (the static one fades out), false when it gives up. */
  onActiveChange: (active: boolean) => void
}) {
  const [failed, setFailed] = useState(() => !supportsWebGL2())
  const onActiveRef = useRef(onActiveChange)
  useEffect(() => {
    onActiveRef.current = onActiveChange
  }, [onActiveChange])
  useEffect(() => () => onActiveRef.current(false), [])

  if (failed) return null
  const fail = () => {
    setFailed(true)
    onActiveRef.current(false)
  }
  return (
    <ShaderBoundary onFail={fail}>
      <HeatmapCanvas awake={awake} silhouette={silhouette} width={width} height={height} scale={scale} onReady={() => onActiveRef.current(true)} onFail={fail} />
    </ShaderBoundary>
  )
}
