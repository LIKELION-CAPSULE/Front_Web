import { CAPSULE_ASPECT } from '../../mates/capsule-jar/capsule-jar-layout.ts'
import { KEEPSAKE_SCALE } from '../../mates/capsule-jar/capsule-floor-layout.ts'
import { BOARD, type BoardCapsule, type BoardMode, type BoardTile, type CapsuleColors } from './capsule-board-layout.ts'

/**
 * 「유리 기둥」 comparison draft of the 2.5D board (DEV only, `/records?pillars=glass|glass-aid`): every day a thin glass
 * pillar whose height is the day's time, the day's capsules lying inside it, stacked from the bottom. Pure and
 * renderer-free (unit-tested); drawn by capsule-board-scene.ts. The current upright columns stay the default.
 *
 * Height rule: the period's longest day, rounded **up to whole hours (at least 2 h)**, is the full pillar height
 * (`PILLAR_DIMS.maxHeight`); every day stands in proportion to its exact time, so heights compare like a bar chart and
 * the guide lines fall on whole hours. Rounding up keeps the top from always touching the same height whatever the
 * period's longest day was, and the 2 h floor keeps a 30-minute week from looking like a full one.
 *
 * Capsules: still one capsule = 30 minutes (the day's capsule count of capsule-board-layout.ts), lying across the
 * pillar and filling its height evenly. Where a 30-minute step is taller than a lying capsule they lean a little, all
 * the same way, each turned a bit further round the pillar (a tidy spiral; a fill of light closes what is left);
 * where it is too thin for a readable capsule the pillar shows a
 * fill of light (coloured by connection, layer by layer) with only the top few capsules and any keepsake drawn.
 */

export type PillarMode = 'off' | 'glass' | 'glass-aid'
export const PILLAR_MODES: readonly PillarMode[] = ['off', 'glass', 'glass-aid']
export const PILLAR_MODE_LABELS: Readonly<Record<PillarMode, string>> = { off: '지금', glass: '유리 기둥', 'glass-aid': '유리 기둥+보조' }

export function parsePillarMode(value: string | null | undefined): PillarMode {
  return value === 'glass' || value === 'glass-aid' ? value : 'off'
}

/** Pillars are drawn for the week and the month (the year keeps its columns: 365 pillars read as a carpet of dots). */
export const pillarsApply = (mode: PillarMode, period: BoardMode) => mode !== 'off' && period !== 'year'

/**
 * Pillar size per period (tile units; tile pitch 1, tile 0.86). With the aid the month's pillars are thinner and lower
 * and the camera looks down more steeply, so the front rows hide less of the rows behind them.
 */
export function pillarDims(period: BoardMode, aid: boolean) {
  if (period === 'week') return { maxHeight: 2.1, radius: 0.22, elevation: 0 }
  return aid ? { maxHeight: 1.25, radius: 0.19, elevation: 4 } : { maxHeight: 1.45, radius: 0.22, elevation: 0 }
}

/** Hours that the full pillar height stands for: the longest day rounded up to whole hours, at least 2. */
export function pillarScaleHours(tiles: readonly Pick<BoardTile, 'day'>[]) {
  const longest = tiles.reduce((max, tile) => Math.max(max, tile.day.connectionSeconds), 0)
  return Math.max(2, Math.ceil(longest / 3600 - 1e-9))
}

export function pillarHeight(seconds: number, scaleHours: number, maxHeight: number) {
  return Math.max(0, Math.min(1, seconds / 3600 / scaleHours)) * maxHeight
}

/** Guide lines (the aid): two or three whole hours up to the scale. */
export function guideHours(scaleHours: number): number[] {
  const step = scaleHours <= 3 ? 1 : scaleHours <= 6 ? 2 : Math.ceil(scaleHours / 3)
  const hours: number[] = []
  for (let hour = step; hour <= scaleHours + 1e-9; hour += step) hours.push(hour)
  return hours
}

/** The period's longest day (the aid marks its pillar), or null without records. */
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

/** Height of the full stack (columns) for the camera and the picking: pillars use the pillar height. */
export function standingHeight(tile: Pick<BoardTile, 'height'>, pillar: PillarLayout | null) {
  return pillar ? pillar.height : tile.height
}

export { BOARD }
