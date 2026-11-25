import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { BoardView } from './capsule-board/capsule-board-view'
import { GRID_MORPH_EASING } from './grid-morph'
import './board-view-switch.css'

/** 2D ↔ 2.5D: 400–600 ms in all (user request 2026-11-26). */
export const VIEW_SWITCH_MS = 520
const VIEW_SWITCH_DELAY_MS = 70
/** The flat grid tipped back as if seen at the 2.5D board's angle. */
const TILTED = 'perspective(1100px) rotateX(48deg) scale(0.94)'
const FLAT = 'perspective(1100px) rotateX(0deg) scale(1)'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const nextFrames = (count: number, then: () => void) => {
  let left = count
  let id = 0
  const step = () => {
    left -= 1
    if (left <= 0) then()
    else id = requestAnimationFrame(step)
  }
  id = requestAnimationFrame(step)
  return () => cancelAnimationFrame(id)
}

/**
 * The records board's 2D grid and 2.5D scene, and the move between them. The two cannot morph into each other (a DOM
 * grid of week columns vs. a WebGL scene of month boards and pillars), so the move is an approximation: the grid tips
 * back into the scene's angle while the scene fades in, or the scene fades while the grid lies down flat — tilt and
 * crossfade, `VIEW_SWITCH_MS`, the board's height following.
 *
 * The scene is costly to create, so the move waits for it: the incoming layer mounts hidden over the outgoing one (the
 * board keeps the outgoing height), and the move starts on the scene's first drawn frames (`onReady` + two frames), the grid staying on screen meanwhile. While the grid shows, the scene's
 * chunk is fetched when the browser is idle. Reduced motion: the view changes at once. Both layers keep the page's
 * selection; the toggle keeps the focus.
 */
export function BoardViewSwitch({
  view,
  grid,
  board,
}: {
  view: BoardView
  grid: ReactNode
  /** The 2.5D board; call `onReady` once its scene has drawn. */
  board: (onReady: () => void) => ReactNode
}) {
  const [shown, setShown] = useState<BoardView>(view)
  const [boardReady, setBoardReady] = useState(false)
  const reduced = prefersReducedMotion()
  const settled = reduced ? view : shown
  const incoming = view !== settled ? view : null
  const stageRef = useRef<HTMLDivElement>(null)
  const layers = useRef<Partial<Record<BoardView, HTMLDivElement | null>>>({})
  const onBoardReady = useCallback(() => setBoardReady(true), [])

  // Fetch the scene's chunk ahead while the grid shows (the 2.5D switch then only has to build the scene).
  useEffect(() => {
    if (settled !== '2d' || typeof window === 'undefined') return
    const load = () => void import('./capsule-board/capsule-board-scene').catch(() => {})
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(load, 1500)
    return () => window.clearTimeout(id)
  }, [settled])

  const ready = incoming === '2d' || (incoming === '25d' && boardReady)
  useLayoutEffect(() => {
    const stage = stageRef.current
    const into = incoming ? layers.current[incoming] : null
    const outOf = layers.current[settled]
    if (!incoming || !ready || !stage || !into || !outOf) return
    let animations: Animation[] = []
    let cancelled = false
    const start = () => {
      const from = outOf.getBoundingClientRect().height
      const to = into.getBoundingClientRect().height
      const timing = { duration: VIEW_SWITCH_MS, easing: GRID_MORPH_EASING, fill: 'both' as const }
      animations = [
        stage.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: VIEW_SWITCH_MS + VIEW_SWITCH_DELAY_MS, easing: GRID_MORPH_EASING }),
        ...(incoming === '25d'
          ? [
              // The grid tips back into the scene's angle and fades; the scene comes up under it.
              outOf.animate([{ transform: FLAT, opacity: 1 }, { transform: TILTED, opacity: 0 }], { ...timing, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' }),
              into.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { ...timing, delay: VIEW_SWITCH_DELAY_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }),
            ]
          : [
              // The scene fades; the grid lies down flat from the scene's angle.
              outOf.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: VIEW_SWITCH_MS - 120, easing: 'ease-in' }),
              into.animate([{ transform: TILTED, opacity: 0 }, { transform: FLAT, opacity: 1 }], { ...timing, delay: VIEW_SWITCH_DELAY_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }),
            ]),
      ]
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (cancelled) return
        setShown(incoming)
        if (incoming === '2d') setBoardReady(false)
      })
    }
    // The scene's first frames are drawn before it shows (its creation must not stutter the move).
    const cancelFrames = incoming === '25d' ? nextFrames(2, start) : (start(), () => {})
    return () => {
      cancelled = true
      cancelFrames()
      animations.forEach((animation) => animation.cancel())
    }
  }, [incoming, ready, settled])

  const visible = (['2d', '25d'] as const).filter((value) => value === settled || value === incoming)
  return (
    <div ref={stageRef} className="board-view-switch" data-switching={incoming ? '' : undefined}>
      {visible.map((value) => (
        <div
          key={value}
          ref={(element) => {
            layers.current[value] = element
          }}
          className="board-view-layer"
          data-role={value === incoming ? 'in' : incoming ? 'out' : 'shown'}
          data-view={value}
          aria-hidden={value === incoming || undefined}
          inert={value === incoming || undefined}
        >
          {value === '2d' ? grid : board(onBoardReady)}
        </div>
      ))}
    </div>
  )
}
