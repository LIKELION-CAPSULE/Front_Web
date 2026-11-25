import { CAPSULE_ASPECT } from '../../mates/capsule-jar/capsule-jar-layout.ts'
import { KEEPSAKE_SCALE } from '../../mates/capsule-jar/capsule-floor-layout.ts'
import { BOARD, type BoardCapsule, type BoardMode, type BoardTile, type CapsuleColors } from './capsule-board-layout.ts'

/**
 * 「유리 기둥」 — the 2.5D board of every period (week and month decided 2026-11-25; the year joined 2026-11-26, it had
 * kept the older upright capsule columns — one capsule per 30 minutes stacked up to 4 hours — and read as another
 * board): every day a thin glass pillar whose height is the day's time, the day's capsules lying inside it, stacked
 * from the bottom. Pure and renderer-free (unit-tested); drawn by capsule-board-scene.ts. (2D is the records page's
 * contribution grid, not this scene.)
 *
 * Height rule: the period's longest day, rounded **up to whole hours (at least 2 h)**, is the full pillar height
 * (`pillarDims().maxHeight`); every day stands in proportion to its exact time, so heights compare like a bar chart and
 * the week's guide lines fall on whole hours. Rounding up keeps the top from always touching the same height whatever
 * the period's longest day was, and the 2 h floor keeps a 30-minute week from looking like a full one.
 *
 * Capsules: still one capsule = 30 minutes (the day's capsule count of capsule-board-layout.ts), lying across the
 * pillar and filling its height evenly. Where a 30-minute step is taller than a lying capsule they lean a little, all
 * the same way, each turned a bit further round the pillar (a tidy spiral; a fill of light closes what is left);
 * where it is too thin for a readable capsule the pillar shows a fill of light (coloured by connection, layer by
 * layer) with only the top few capsules and any keepsake drawn.
 *
 * Aids: the week has whole-hour guide lines on the board's back wall; week and month mark the period's longest day
 * (「가장 긴 날」 chip, CapsuleBoard). The month has no ticks (they read as clutter) but thinner, lower pillars and a
 * steeper camera, so the front rows hide less of the rows behind. The year's twelve month boards take the thinnest,
 * lowest pillars (most days show as a short fill of light, the top capsules drawn), so 365 days stay one landscape.
 */

/** Pillars are drawn for every period: one height rule for week, month and year. */
export const pillarsApply = (period: BoardMode) => period === 'week' || period === 'month' || period === 'year'

/** The week's whole-hour guide lines on the back wall (the month has none). */
export const guidesApply = (period: BoardMode) => period === 'week'

/**
 * Pillar size per period (tile units; tile pitch 1, tile 0.86) and the extra camera elevation. The month's pillars are
 * thinner and lower and its camera looks down 4° more steeply, so the front rows hide less of the rows behind them.
 */
export function pillarDims(period: BoardMode) {
  if (period === 'week') return { maxHeight: 2.1, radius: 0.22, elevation: 0 }
  if (period === 'month') return { maxHeight: 1.25, radius: 0.19, elevation: 4 }
  // The year: the same camera as before (already steep), lower and thinner pillars for its small tiles.
  return { maxHeight: 1.1, radius: 0.17, elevation: 0 }
}

/** Hours that the full pillar height stands for: the longest day rounded up to whole hours, at least 2. */
export function pillarScaleHours(tiles: readonly Pick<BoardTile, 'day'>[]) {
  const longest = tiles.reduce((max, tile) => Math.max(max, tile.day.connectionSeconds), 0)
  return Math.max(2, Math.ceil(longest / 3600 - 1e-9))
}

export function pillarHeight(seconds: number, scaleHours: number, maxHeight: number) {
  return Math.max(0, Math.min(1, seconds / 3600 / scaleHours)) * maxHeight
}

/** The week's guide lines: two or three whole hours up to the scale. */
export function guideHours(scaleHours: number): number[] {
  const step = scaleHours <= 3 ? 1 : scaleHours <= 6 ? 2 : Math.ceil(scaleHours / 3)
  const hours: number[] = []
  for (let hour = step; hour <= scaleHours + 1e-9; hour += step) hours.push(hour)
  return hours
}

/** The period's longest day (its pillar gets the 「가장 긴 날」 chip and a brighter top ring), or null without records. */
export function longestDayKey(tiles: readonly Pick<BoardTile, 'day'>[]): string | null {
  let best: Pick<BoardTile, 'day'> | null = null
  for (const tile of tiles) if (tile.day.connectionSeconds > 0 && (!best || tile.day.connectionSeconds > best.day.connectionSeconds)) best = tile
  return best?.day.key ?? null
}

/** Below this length (tile units) a lying capsule no longer reads as one: the pillar switches to its fill of light. */
export const PILLAR_MIN_CAPSULE = 0.17
/** Capsules drawn at the top of a filled pillar. */
export const PILLAR_TOP_CAPSULES = 3
/** The most a capsule leans to fill a tall 30-minute step (radians). */
const MAX_TILT = (34 * Math.PI) / 180

export type PillarCapsule = {
  /** Centre height above the tile top. */
  y: number
  length: number
  /** Lean from horizontal (radians, alternating sign) and heading around the pillar's axis. */
  tilt: number
  yaw: number
  visible: boolean
}
export type PillarSegment = { y0: number; y1: number; colors: CapsuleColors }
export type PillarLayout = {
  height: number
  /** One per capsule of the tile, in the tile's order. */
  capsules: PillarCapsule[]
  /** Runs of the same colours, bottom → top (the fill's layers: mate by mate, or connection by connection). */
  segments: PillarSegment[]
  /** Too many capsules for the pillar: light fill + the top few. */
  simplified: boolean
}

/** Vertical extent of a lying capsule leaning by `tilt`. */
const extent = (length: number, tilt: number) => length * Math.sin(tilt) + length * CAPSULE_ASPECT * Math.cos(tilt)

export function pillarLayout(
  capsules: readonly Pick<BoardCapsule, 'colors' | 'keepsake' | 'roll'>[],
  seconds: number,
  { scaleHours, maxHeight, radius }: { scaleHours: number; maxHeight: number; radius: number },
): PillarLayout {
  const count = capsules.length
  const height = count ? Math.max(pillarHeight(seconds, scaleHours, maxHeight), 0.06) : 0
  if (!count) return { height: 0, capsules: [], segments: [], simplified: false }
  const pitch = height / count
  const inner = radius * 2 * 0.9
  // As long as the pillar allows and as thick as the step allows.
  const fitted = Math.min(inner, (pitch * 0.96) / CAPSULE_ASPECT)
  const simplified = fitted < PILLAR_MIN_CAPSULE
  const length = simplified ? Math.min(inner, 0.26) : fitted
  // Lean to close the gap of a tall step (never past MAX_TILT): the smallest lean whose extent fills the step.
  let tilt = 0
  if (!simplified && extent(length, 0) < pitch * 0.96) {
    let lo = 0
    let hi = MAX_TILT
    for (let step = 0; step < 24; step++) {
      const mid = (lo + hi) / 2
      if (extent(length, mid) < pitch * 0.96) lo = mid
      else hi = mid
    }
    tilt = hi
  }
  const thick = extent(length, 0)
  const list = capsules.map((capsule, index): PillarCapsule => {
    const yaw = 0.5 + index * 0.75 + capsule.roll * 0.08
    if (!simplified) return { y: pitch * (index + 0.5), length, tilt, yaw, visible: true }
    // Filled: the top few sit at the top of the light, any keepsake at its own height.
    const fromTop = count - 1 - index
    if (fromTop < PILLAR_TOP_CAPSULES) {
      return { y: Math.max(thick / 2, height - thick * (fromTop + 0.55)), length, tilt: 0, yaw, visible: true }
    }
    const keepsake = capsule.keepsake > 0
    return {
      y: Math.max(thick / 2, Math.min(height - thick * (PILLAR_TOP_CAPSULES + 0.5), pitch * (index + 0.5))),
      length: keepsake ? Math.min(inner, length * KEEPSAKE_SCALE) : length,
      tilt: 0,
      yaw,
      visible: keepsake,
    }
  })
  const segments: PillarSegment[] = []
  capsules.forEach((capsule, index) => {
    const last = segments[segments.length - 1]
    const y1 = pitch * (index + 1)
    if (last && last.colors === capsule.colors) last.y1 = y1
    else segments.push({ y0: pitch * index, y1, colors: capsule.colors })
  })
  return { height, capsules: list, segments, simplified }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
/** Shortest turn between two headings. */
const mixAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

/**
 * A day's pillar part-way through a period morph (week ↔ month, moving to another week or month): the pillar and its
 * capsules go from the form they had (`from`, in the old period's scale and size) to the new one (`to`) as `t` goes
 * 0 → 1. A day's capsules are the same in both periods; if the counts differ anyway, the new form is used as is.
 * Capsules that only one form draws (the filled pillar's hidden ones) shrink in or out instead of popping.
 */
export function mixPillar(
  from: { layout: PillarLayout; radius: number },
  to: { layout: PillarLayout; radius: number },
  t: number,
): { height: number; radius: number; capsules: PillarCapsule[] } {
  const height = mix(from.layout.height, to.layout.height, t)
  const radius = mix(from.radius, to.radius, t)
  if (from.layout.capsules.length !== to.layout.capsules.length) return { height, radius, capsules: to.layout.capsules }
  const capsules = to.layout.capsules.map((next, index): PillarCapsule => {
    const previous = from.layout.capsules[index]!
    const shown = (capsule: PillarCapsule) => (capsule.visible ? capsule.length : 0)
    return {
      y: mix(previous.y, next.y, t),
      length: mix(shown(previous), shown(next), t),
      tilt: mix(previous.tilt, next.tilt, t),
      yaw: mixAngle(previous.yaw, next.yaw, t),
      visible: previous.visible || next.visible,
    }
  })
  return { height, radius, capsules }
}

/** A day's pillar form: its layout and radius. */
export type PillarForm = { layout: PillarLayout; radius: number }

/**
 * The form a day's pillar shows at `t` (eased) of a morph from `from` (null: nothing to blend from) to `to`, as a form
 * the next morph can start from. A period change during a morph starts from what is on screen, not from the target
 * of the morph it cuts short, so the pillar does not jump. The fill's layers keep `to`'s segments (the scene scales
 * them by the height shown).
 */
export function pillarFormAt(from: PillarForm | null, to: PillarForm, t: number): PillarForm {
  if (!from || t >= 1) return to
  const shown = mixPillar(from, to, t)
  return { layout: { ...to.layout, height: shown.height, capsules: shown.capsules }, radius: shown.radius }
}

/** How strongly the week's guide lines show over a morph: `from` → `to` as the eased morph goes 0 → 1. */
export type GuideFade = { from: number; to: number }

export const guideLevel = (fade: GuideFade, t: number) => fade.from + (fade.to - fade.from) * Math.max(0, Math.min(1, t))

/**
 * The guide lines of a morph that starts with `shown` on screen (whose board's lines at which strength) towards a
 * board that has guide lines (`next.guides`, the week) or not. Into a week its lines fade in from the strength shown
 * (a morph cut short on its way out of the week turns back without a jump); out of it the lines shown fade out from
 * where they are, on their own board's wall.
 */
export function planGuides<T>(
  shown: { source: T | null; level: number },
  next: { model: T; guides: boolean },
): { source: T | null; fade: GuideFade } {
  const level = shown.source === null ? 0 : Math.max(0, Math.min(1, shown.level))
  if (next.guides) return { source: next.model, fade: { from: level, to: 1 } }
  if (shown.source === null || level <= 0) return { source: null, fade: { from: 0, to: 0 } }
  return { source: shown.source, fade: { from: level, to: 0 } }
}

/** Instanced meshes and their per-instance attributes are made for at least one instance (three needs a buffer). */
export const instanceCapacity = (count: number) => Math.max(1, count)

/**
 * The pillar instances of a board: each tube / top ring is one day with a pillar, each fill layer one run of the
 * same colours in it. Rebuilt whenever the days change (also on every period morph), so the meshes always fit.
 */
export function pillarInstances(pillars: readonly (PillarLayout | null)[]): {
  entries: number[]
  runs: { entry: number; y0: number; y1: number; colors: CapsuleColors }[]
} {
  const entries: number[] = []
  const runs: { entry: number; y0: number; y1: number; colors: CapsuleColors }[] = []
  pillars.forEach((pillar, index) => {
    if (!pillar || pillar.height <= 0) return
    entries.push(index)
    for (const segment of pillar.segments) runs.push({ entry: index, y0: segment.y0, y1: segment.y1, colors: segment.colors })
  })
  return { entries, runs }
}

export { BOARD }
