/**
 * The tour's dim with its lit hole, moved on the compositor only (user decision 2026-11-26: the old hole animated
 * top/left/width/height with a full-screen `box-shadow` and a glow, repainting the whole screen every frame).
 *
 * Pieces (tour-layer.css), all `transform` only (a move writes transforms each frame, on whole pixels, on the cursor's
 * own clock and easing — no layout, no paint; whole pixels keep the pieces' edges joined without seams):
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
/** A move: its length and easing (`t` 0–1 → progress 0–1), the same the cursor uses. */
export type SpotMotion = { duration: number; ease: (t: number) => number }

/** The cursor's `ease-out` (showcase-pointer-motion.ts): 1 − (1 − t)³. */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** A hole between two holes, on whole pixels (fractional edges would show seams between the pieces). */
export function spotBetween(from: SpotRect, to: SpotRect, progress: number): SpotRect {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * progress)
  return { left: mix(from.left, to.left), top: mix(from.top, to.top), width: mix(from.width, to.width), height: mix(from.height, to.height) }
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
  /** The hole drawn now (mid-move too). */
  private drawn: SpotRect
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
    this.drawn = closedSpot(innerWidth, innerHeight)
    this.draw(this.drawn)
  }

  /** The hole now (null: none). */
  get spot() { return this.current }
  get moving() { return this.frame !== 0 }

  /**
   * Lights `spot` (null: no hole). With `motion` the hole eases there (the cursor moves with the same duration and
   * easing, on the same frames); without, it is placed at once (following a scroll or a resize, reduced motion).
   */
  place(spot: SpotRect | null, motion: SpotMotion | null = null) {
    const box = this.root.getBoundingClientRect()
    this.origin = { x: Math.round(box.left), y: Math.round(box.top) }
    const target = spot ?? closedSpot(innerWidth, innerHeight)
    this.current = spot
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.placeRing(spot, motion)
    if (!motion || typeof requestAnimationFrame !== 'function') { this.draw(target); return }
    const from = this.drawn
    let start = -1
    const step = (time: number) => {
      if (start < 0) start = time
      const progress = Math.min(1, (time - start) / motion.duration)
      this.draw(spotBetween(from, target, motion.ease(progress)))
      this.frame = progress < 1 ? requestAnimationFrame(step) : 0
    }
    this.frame = requestAnimationFrame(step)
  }

  /** Re-applies the hole for a new screen size (the shades are sized in viewport units). */
  resize() {
    if (!this.moving) this.draw(this.current ?? closedSpot(innerWidth, innerHeight))
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    window.clearTimeout(this.ringTimer)
  }

  private draw(spot: SpotRect) {
    this.drawn = spot
    const { x, y } = this.origin
    const next = spotlightTransforms({ ...spot, left: spot.left - x, top: spot.top - y }, innerWidth, innerHeight)
    this.root.toggleAttribute('data-corners', next.corners)
    for (const name of PIECES) this.pieces[name].style.transform = next[name]
  }

  private placeRing(spot: SpotRect | null, motion: SpotMotion | null) {
    window.clearTimeout(this.ringTimer)
    const show = () => {
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
    if (!motion) { show(); return }
    // Moving: the ring fades out at once and comes back where the hole lands.
    this.ring.removeAttribute('data-spot')
    this.ringTimer = window.setTimeout(show, motion.duration)
  }
}
