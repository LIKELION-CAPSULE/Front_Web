import { spring } from 'motion'
import { spotSpring } from './tour-motion.ts'

/**
 * The tour's dim with its lit hole, moved on the compositor only (user decision 2026-11-26: the old hole animated
 * top/left/width/height with a full-screen `box-shadow` and a glow, repainting the whole screen every frame).
 *
 * A move (user decision 2026-11-26, 「좀 더 자연스럽게」): the hole rides a spring (motion's `spring`, tour-motion.ts) that
 * chases the cursor's own progress — the target box slides from where the hole is to where it goes on the arrow's
 * speed profile, and each edge follows it on the spring, so the light trails the arrow a little and settles onto the
 * target just after it lands, without a bounce. A scroll mid-move moves the target (the spring keeps its velocity).
 *
 * Pieces (tour-layer.css), all `transform` only (a move writes transforms each frame, on whole pixels — no layout, no
 * paint; whole pixels keep the pieces' edges joined without seams):
 * - four flat shades around the hole: top and bottom are full-screen sheets moved up/down (translate), left and right
 *   are 100px-tall strips moved and stretched to the hole's height (translate + scaleY — a flat colour stretches
 *   without any visible change). Every edge follows the same eased transform, so they stay joined while moving.
 * - four 18px corner caps (the hole's rounded corners), moved only.
 * - the lit ring (the violet edge and glow): painted once at the hole's size; hidden while the hole moves and shown
 *   again where it lands (opacity only), so the glow is never repainted per frame.
 *
 * Pure geometry (`spotlightTransforms`) is separate from the DOM so Node tests can check it.
 */

export type SpotRect = { left: number; top: number; width: number; height: number }
/** A move: the cursor's length (ms) and its progress over time (`t` 0–1 → 0–1), which the spring chases. */
export type SpotMotion = { duration: number; ease: (t: number) => number }

/** A hole between two holes, on whole pixels (fractional edges would show seams between the pieces). */
export function spotBetween(from: SpotRect, to: SpotRect, progress: number): SpotRect {
  return roundSpot(mixSpot(from, to, progress))
}

const mixSpot = (from: SpotRect, to: SpotRect, progress: number): SpotRect => {
  const mix = (a: number, b: number) => a + (b - a) * progress
  return { left: mix(from.left, to.left), top: mix(from.top, to.top), width: mix(from.width, to.width), height: mix(from.height, to.height) }
}
const roundSpot = (spot: SpotRect): SpotRect => ({ left: Math.round(spot.left), top: Math.round(spot.top), width: Math.round(spot.width), height: Math.round(spot.height) })

const EDGES = ['left', 'top', 'width', 'height'] as const
type Edge = (typeof EDGES)[number]
type SpringGenerator = ReturnType<typeof spring>

/**
 * The hole's four numbers on motion's spring, each chasing a target that moves (retargeted every frame from where it
 * is and how fast it goes). Pure: Node tests drive it with their own clock.
 */
export class SpotSpring {
  private value: SpotRect
  private readonly velocity: Record<Edge, number> = { left: 0, top: 0, width: 0, height: 0 }
  private generators: Record<Edge, SpringGenerator> | null = null

  constructor(start: SpotRect) {
    this.value = { ...start }
  }

  get now(): SpotRect { return { ...this.value } }

  /** A new move of `moveMs`: the spring's stiffness follows the move's length (velocity is kept). */
  tune(moveMs: number) {
    const options = spotSpring(moveMs)
    const make = (edge: Edge) => spring({ keyframes: [this.value[edge], this.value[edge]], velocity: this.velocity[edge], ...options })
    this.generators = { left: make('left'), top: make('top'), width: make('width'), height: make('height') }
  }

  /** Advances `dt` ms toward `target`; true when every edge is at rest on it. */
  step(target: SpotRect, dt: number): boolean {
    if (!this.generators) this.tune(0)
    let rest = true
    for (const edge of EDGES) {
      const generator = this.generators![edge]
      generator.retarget?.([this.value[edge], target[edge]], this.velocity[edge])
      const state = generator.next(dt)
      this.value[edge] = state.value
      this.velocity[edge] = state.done ? 0 : (generator.velocity?.(dt) ?? 0)
      if (!state.done) rest = false
    }
    return rest
  }

  /** Placed at once (no motion). */
  jump(spot: SpotRect) {
    this.value = { ...spot }
    for (const edge of EDGES) this.velocity[edge] = 0
  }
}

/** The strips' own height; scaleY stretches them to the hole. */
export const STRIP_PX = 100
/** The hole's corner radius (tour-layer.css corner caps). */
export const SPOT_RADIUS = 18

/** No hole: an empty one in the middle of the screen (the shades meet and cover it all). */
export const closedSpot = (width: number, height: number): SpotRect => ({ left: Math.round(width / 2), top: Math.round(height / 2), width: 0, height: 0 })

export type SpotTransforms = {
  top: string
  bottom: string
  left: string
  right: string
  tl: string
  tr: string
  bl: string
  br: string
  /** The corner caps fit inside the hole (it is at least two radii wide and tall). */
  corners: boolean
}

/** Transforms of every piece for a hole on a `width` × `height` screen. */
export function spotlightTransforms(spot: SpotRect, width: number, height: number): SpotTransforms {
  const { left, top } = spot
  const right = left + spot.width
  const bottom = top + spot.height
  const scale = Math.max(0, spot.height) / STRIP_PX
  const at = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`
  return {
    top: at(0, top - height),
    bottom: at(0, bottom),
    left: `${at(left - width, top)} scaleY(${scale})`,
    right: `${at(right, top)} scaleY(${scale})`,
    tl: at(left, top),
    tr: at(right - SPOT_RADIUS, top),
    bl: at(left, bottom - SPOT_RADIUS),
    br: at(right - SPOT_RADIUS, bottom - SPOT_RADIUS),
    corners: spot.width >= SPOT_RADIUS * 2 && spot.height >= SPOT_RADIUS * 2,
  }
}

const PIECES = ['top', 'bottom', 'left', 'right', 'tl', 'tr', 'bl', 'br'] as const
type Piece = (typeof PIECES)[number]

/** Drives the pieces inside `root` (`.service-tour-dim`) and the ring (`.service-tour-spot`). */
export class Spotlight {
  private readonly root: HTMLElement
  private readonly ring: HTMLElement
  private readonly pieces: Record<Piece, HTMLElement>
  private current: SpotRect | null = null
  /** The hole on its spring (fractional; drawn on whole pixels). */
  private readonly spring: SpotSpring
  /** The move under way: from where the hole was to `to`; `actual` is where the lit elements are now (a scroll). */
  private move: { from: SpotRect; to: SpotRect; actual: SpotRect | null; motion: SpotMotion; start: number; last: number } | null = null
  private frame = 0
  private ringTimer = 0
  private ringSize = ''
  /**
   * Where the pieces' own origin sits on screen. Inside the account modal the layer's fixed box can start off the
   * viewport's corner: holes (in viewport coordinates) are shifted by it. Measured once per placement, not per frame.
   */
  private origin = { x: 0, y: 0 }

  constructor(root: HTMLElement, ring: HTMLElement) {
    this.root = root
    this.ring = ring
    const piece = (selector: string) => root.querySelector<HTMLElement>(selector)!
    this.pieces = {
      top: piece('[data-side="top"]'), bottom: piece('[data-side="bottom"]'), left: piece('[data-side="left"]'), right: piece('[data-side="right"]'),
      tl: piece('[data-corner="tl"]'), tr: piece('[data-corner="tr"]'), bl: piece('[data-corner="bl"]'), br: piece('[data-corner="br"]'),
    }
    const closed = closedSpot(innerWidth, innerHeight)
    this.spring = new SpotSpring(closed)
    this.draw(closed)
  }

  /** The hole now (null: none). */
  get spot() { return this.current }
  get moving() { return this.move !== null }

  /**
   * Lights `spot` (null: no hole). With `motion` the hole follows the cursor's move on its spring (it starts on the
   * same frame as the arrow); without, it is placed at once (a scroll or a resize at rest, reduced motion).
   */
  place(spot: SpotRect | null, motion: SpotMotion | null = null) {
    const box = this.root.getBoundingClientRect()
    this.origin = { x: Math.round(box.left), y: Math.round(box.top) }
    const target = spot ?? closedSpot(innerWidth, innerHeight)
    this.current = spot
    this.placeRing(motion)
    if (!motion || typeof requestAnimationFrame !== 'function') {
      cancelAnimationFrame(this.frame)
      this.frame = 0
      this.move = null
      this.spring.jump(target)
      this.draw(target)
      return
    }
    this.spring.tune(motion.duration)
    this.move = { from: this.spring.now, to: target, actual: null, motion, start: -1, last: -1 }
    // Counted for check-service-tour.mjs (each move's start against the arrow's): one attribute write per move.
    this.root.dataset.moves = String(Number(this.root.dataset.moves ?? 0) + 1)
    if (!this.frame) this.frame = requestAnimationFrame(this.step)
  }

  /**
   * Where the lit elements are now (re-measured on a scroll or a resize). At rest the hole moves there at once; mid-move
   * the end of the move bends onto it, and the spring settles on it.
   */
  follow(spot: SpotRect | null) {
    if (!this.move) { this.place(spot); return }
    this.current = spot
    this.move.actual = spot ?? closedSpot(innerWidth, innerHeight)
    // The edge, once shown (the arrow has landed), stays on the target.
    if (this.ring.hasAttribute('data-spot')) this.showRing()
  }

  /** Re-applies the hole for a new screen size (the shades are sized in viewport units). */
  resize() {
    if (!this.moving) this.draw(this.current ?? closedSpot(innerWidth, innerHeight))
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.move = null
    window.clearTimeout(this.ringTimer)
  }

  private readonly step = (time: number) => {
    const move = this.move
    if (!move) { this.frame = 0; return }
    if (move.start < 0) { move.start = time; move.last = time }
    const dt = Math.min(50, time - move.last)
    move.last = time
    const progress = move.motion.duration > 0 ? Math.min(1, (time - move.start) / move.motion.duration) : 1
    let target = mixSpot(move.from, move.to, move.motion.ease(progress))
    if (move.actual) {
      // The same cubic weight as the arrow's follow (showcase-pointer `follow`): the end bends onto the target.
      const weight = progress * progress * progress
      const actual = move.actual
      const shift = (edge: Edge) => target[edge] + (actual[edge] - move.to[edge]) * weight
      target = { left: shift('left'), top: shift('top'), width: shift('width'), height: shift('height') }
    }
    const rest = this.spring.step(target, dt)
    this.draw(roundSpot(this.spring.now))
    if (progress >= 1 && rest) {
      this.move = null
      this.frame = 0
      return
    }
    this.frame = requestAnimationFrame(this.step)
  }

  private draw(spot: SpotRect) {
    const { x, y } = this.origin
    const next = spotlightTransforms({ ...spot, left: spot.left - x, top: spot.top - y }, innerWidth, innerHeight)
    this.root.toggleAttribute('data-corners', next.corners)
    for (const name of PIECES) this.pieces[name].style.transform = next[name]
  }

  /** The violet edge: shown at once without motion; mid-move it fades out and comes back where the arrow lands. */
  private placeRing(motion: SpotMotion | null) {
    window.clearTimeout(this.ringTimer)
    if (!motion) { this.showRing(); return }
    this.ring.removeAttribute('data-spot')
    this.ringTimer = window.setTimeout(() => this.showRing(), motion.duration)
  }

  private showRing() {
    const spot = this.current
    if (!spot) { this.ring.removeAttribute('data-spot'); return }
    const size = `${Math.round(spot.width)}x${Math.round(spot.height)}`
    // A new size repaints the ring once; a new place only moves it.
    if (size !== this.ringSize) {
      this.ring.style.width = `${spot.width}px`
      this.ring.style.height = `${spot.height}px`
      this.ringSize = size
    }
    this.ring.style.transform = `translate3d(${spot.left - this.origin.x}px, ${spot.top - this.origin.y}px, 0)`
    this.ring.setAttribute('data-spot', 'true')
  }
}
