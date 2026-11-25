/**
 * How 채린's cursor and the lit area move in the service tour (user decision 2026-11-26: 「좀 더 움직임이 자연스러우면
 * 좋겠다」). Pure numbers, no DOM, so Node tests can check them; ServiceTour.tsx and tour-spotlight.ts use them.
 *
 * - A move is a cubic Bézier that bows a little toward the middle of the screen (the bow grows with the distance, like
 *   a wrist turning), on a minimum-jerk speed profile: it speeds up from rest and slows down onto the target.
 * - Its length follows the distance (a log, like a hand reaching): 300 ms for a nudge, 800 ms across the screen.
 * - Inside a step the cursor flows through the marks it only points at: it slows down near the mark but passes it at a
 *   walking pace, and the next move starts with the same velocity (same direction, same speed), so there is no stop.
 *   It stops only where it presses or types, at the last mark, and before a sharp turn.
 * - The lit area follows the arrow on a spring (motion's `spring`): a soft trail, settling just after the arrow lands.
 */

export type Point = { x: number; y: number }

/** Shortest and longest move. */
export const MOVE_MIN_MS = 300
export const MOVE_MAX_MS = 800

/** A move's length for a distance in px: 300 ms up close, growing with log2 of the distance, 800 ms at most. */
export function moveDuration(distance: number): number {
  const ms = 260 + 110 * Math.log2(1 + Math.max(0, distance) / 40)
  return Math.round(Math.min(MOVE_MAX_MS, Math.max(MOVE_MIN_MS, ms)))
}

/** How far the path bows sideways at its middle, as a share of the distance … */
export const BEND_RATIO = 0.12
/** … and at most this many px (a move across the whole screen bows like a long one, not like a sickle). */
export const BEND_MAX_PX = 110

/** The passing speed through a mark the cursor only points at, as a share of that move's average speed. */
export const PASS_SPEED = 0.45
/** Turns sharper than this (the cosine between the two moves) stop on the mark instead of passing through. */
const PASS_MIN_COS = -0.2

/**
 * The minimum-jerk progress (0–1) at time `t` (0–1) that starts at speed `v0` and ends at speed `v1` — speeds as
 * multiples of the average (1 = the move's average speed), with no acceleration at either end. With 0 and 0 it is the
 * classic 10t³ − 15t⁴ + 6t⁵ of an unhurried human reach.
 */
export function reachProgress(t: number, v0 = 0, v1 = 0): number {
  const p = Math.min(1, Math.max(0, t))
  const r = 1 - v0
  const q = v1 - v0
  const a3 = 10 * r - 4 * q
  const a4 = 7 * q - 15 * r
  const a5 = 6 * r - 3 * q
  return v0 * p + p * p * p * (a3 + p * (a4 + p * a5))
}

export type TourPath = {
  /** ms */
  duration: number
  /** Position at time progress 0–1. */
  at: (progress: number) => Point
  /** Velocity at the end in px/ms (zero when the move stops on its target). */
  exit: Point
  /** Progress along the path at time progress 0–1 (the speed profile; the light's spring chases it). */
  progress: (t: number) => number
  /** The two control points (for tests and drawings). */
  controls: readonly [Point, Point]
}

export type PathOptions = {
  /** The middle of the screen (in the path's own coordinates): the path bows toward it. */
  center: Point
  /** px/ms the cursor already has when the move starts (it flows on from the last move); none: from rest. */
  enter?: Point | null
  /** Where the cursor goes after this target: given (and not a sharp turn), it passes through instead of stopping. */
  then?: Point | null
}

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const length = (a: Point) => Math.hypot(a.x, a.y)
const unit = (a: Point): Point => { const l = length(a); return l > 1e-9 ? scale(a, 1 / l) : { x: 0, y: 0 } }

/** Which way the path bows: +1 or −1 along the left normal (−dy, dx), toward the middle of the screen. */
export function bowSide(from: Point, to: Point, center: Point): 1 | -1 {
  const u = unit(sub(to, from))
  const normal = { x: -u.y, y: u.x }
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const toward = normal.x * (center.x - middle.x) + normal.y * (center.y - middle.y)
  // On the line through the middle either side is fine: bow upward (the arrow's own side), never at random.
  if (Math.abs(toward) < 1) return normal.y <= 0 ? 1 : -1
  return toward > 0 ? 1 : -1
}

/** One move of the cursor from `from` to `to` (see the file comment). */
export function planPath(from: Point, to: Point, options: PathOptions): TourPath {
  const chord = sub(to, from)
  const distance = length(chord)
  const duration = moveDuration(distance)
  if (distance < 0.5) return { duration: 0, at: () => ({ ...to }), exit: { x: 0, y: 0 }, progress: () => 1, controls: [from, to] }
  const u = scale(chord, 1 / distance)
  const side = bowSide(from, to, options.center)
  const normal = { x: -u.y * side, y: u.x * side }
  // A cubic whose two control points sit `h` off the chord bows 0.75·h at its middle.
  const h = Math.min(BEND_MAX_PX, distance * BEND_RATIO) / 0.75
  const third = distance / 3

  // Start: from rest it leaves along the bow; flowing on, along the velocity it already has (no kink, no speed jump).
  let v0 = 0
  let c1 = add(add(from, scale(chord, 1 / 3)), scale(normal, h))
  const enter = options.enter && length(options.enter) > 1e-3 ? options.enter : null
  if (enter) {
    // Speed at the start = |B'(0)| · v0 / duration = distance · v0 / duration.
    v0 = Math.min(1.6, (length(enter) * duration) / distance)
    c1 = add(from, scale(unit(enter), third))
  }

  // End: on a mark it only points at, it passes on toward the next one; otherwise it stops on the target.
  let v1 = 0
  let c2 = add(sub(to, scale(chord, 1 / 3)), scale(normal, h))
  let exit: Point = { x: 0, y: 0 }
  const after = options.then ? sub(options.then, to) : null
  if (after && length(after) > 4) {
    const next = unit(after)
    if (u.x * next.x + u.y * next.y > PASS_MIN_COS) {
      const tangent = unit(add(u, next))
      v1 = PASS_SPEED
      c2 = sub(to, scale(tangent, third))
      exit = scale(tangent, (distance * v1) / duration)
    }
  }

  const progress = (t: number) => reachProgress(t, v0, v1)
  const at = (t: number): Point => {
    const s = progress(t)
    const a = 1 - s
    const k0 = a * a * a, k1 = 3 * a * a * s, k2 = 3 * a * s * s, k3 = s * s * s
    return { x: k0 * from.x + k1 * c1.x + k2 * c2.x + k3 * to.x, y: k0 * from.y + k1 * c1.y + k2 * c2.y + k3 * to.y }
  }
  return { duration, at, exit, progress, controls: [c1, c2] }
}

/**
 * The lit area's spring (motion's `spring`, physics form so it keeps its velocity when retargeted). It chases the
 * arrow's own progress (tour-spotlight.ts), so the light trails the arrow a little and settles just after it lands:
 * `visualDuration` 0.2 × the move (60–160 ms) and bounce 0.1 (damping ratio 0.9) — about 3–4 px behind when the arrow
 * lands, on it within a pixel 17–50 ms later, never past it (Node tests check these).
 */
export const SPOT_SPRING_BOUNCE = 0.1
export const SPOT_SPRING_VISUAL = 0.2

export function spotSpring(moveMs: number) {
  const visualDuration = (Math.max(MOVE_MIN_MS, moveMs) * SPOT_SPRING_VISUAL) / 1000
  const dampingRatio = 1 - SPOT_SPRING_BOUNCE
  // motion's own mapping from visualDuration/bounce (spring.mjs), written out so the spring keeps inherited velocity.
  const stiffness = ((2 * Math.PI) / (visualDuration * 1.2)) ** 2
  return { stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness), mass: 1, restDelta: 0.5, restSpeed: 10 }
}
