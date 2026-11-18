import { damp, GUIDE, guidePose, stepAt } from '../guide-timeline'
import { homography, rectQuad, toMatrix3d } from './screen-projection'
import type { GuideScene } from './guide-scene'

type Elements = {
  /** The overlay's own scroll container; its scroll position drives the guide. */
  scroller: HTMLElement
  /** Viewport-sized layer that holds the canvas; the canvas is sized to it. */
  stage: HTMLElement
  /** Viewport-sized picture placed behind the canvas and fitted to the monitor screen every frame. */
  screen: HTMLElement
}

export type GuideFrame = { step: number; screenStep: number }

/**
 * Drives the 3D guide every frame from the overlay's scroll position, eased so wheel steps glide. Calls `onChange`
 * only when the showing step or monitor picture changes, so React re-renders a handful of times, not every frame.
 */
export function startGuideRuntime({ scroller, stage, screen }: Elements, scene: GuideScene, onChange: (frame: GuideFrame) => void) {
  let raf = 0
  let last = performance.now()
  let smoothed: number | null = null
  let size = ''
  let transform = ''
  let reported = ''
  const pointer = { x: 0, y: 0 }

  function onPointer(event: PointerEvent) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const width = stage.clientWidth
    const height = stage.clientHeight
    if (!width || !height) return
    const range = scroller.scrollHeight - scroller.clientHeight
    const progress = range > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / range)) : 0
    smoothed = smoothed === null ? progress : damp(smoothed, progress, GUIDE.damping, dt)

    const key = `${width}x${height}`
    if (key !== size) {
      size = key
      scene.setSize(width, height)
    }
    const pose = guidePose(smoothed)
    scene.update(pose, now / 1000, dt, pointer)
    scene.render()

    const matrix = homography(rectQuad(0, 0, width, height), scene.screenQuad())
    const next = matrix ? toMatrix3d(matrix) : 'scale(0)'
    if (next !== transform) screen.style.transform = transform = next
    screen.style.setProperty('--guide-screen-dim', pose.screenDim.toFixed(3))

    const frame = { step: stepAt(smoothed), screenStep: pose.screenStep }
    const id = `${frame.step}:${frame.screenStep}`
    if (id !== reported) {
      reported = id
      onChange(frame)
    }
  }

  const listeners = new AbortController()
  window.addEventListener('pointermove', onPointer, { passive: true, signal: listeners.signal })
  screen.style.transformOrigin = '0 0'
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    listeners.abort()
  }
}
