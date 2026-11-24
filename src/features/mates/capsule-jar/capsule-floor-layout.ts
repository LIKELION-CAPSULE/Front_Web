import { hashId, seededRandom, sortCapsules } from './capsule-jar-data.ts'
import { CAPSULE_ASPECT, type CapsulePlacement } from './capsule-jar-layout.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'
import { capsuleBand, capsuleKeepsakes, type TimeBand } from './capsule-moments.ts'

/**
 * Pure layout of the capsule pile at the bottom of the mate panel, seen flat from the side (2D): every capsule lies
 * in the screen plane (z = 0) and is turned only within it. The mate stands in front of the pile (a separate layer),
 * so the pile shows beside her and below her waist. No renderer imports, so it runs in unit tests.
 *
 * - One connection is a *bundle* of capsules, as many as its length (`capsulesForConnection`): 30 min → 3,
 *   1 h → 6, 2 h → 12. The amount shows the time; the size of the capsules does not (only a small natural variation
 *   inside a bundle).
 * - The mate stands in front of the middle and, framed head to waist, covers almost the whole width low down (her hair
 *   and arms). So most capsules go into two side bins that rise up beside her (`PILE.sideFill` high), where her
 *   silhouette narrows; a lower layer fills the middle behind her waist. The bins' inner walls (`PILE.binEdge`) stand
 *   inside her silhouette, so they never show; the physics has the same walls, so a heap cannot level out (round
 *   capsules roll over each other and would flatten any free-standing slope).
 * - Bundles go to the bin that is least full for its share and stack on what lies there (a 2D height profile).
 * - The capsule size follows the total count so 30 or 300 capsules both fill the bins to about the same height.
 * - Every capsule of a bundle carries its connection's time band (its tint) and one capsule of a milestone connection
 *   is the keepsake: `KEEPSAKE_SCALE` × the base length (so it also takes that room in the pile and in the physics)
 *   and the brightest glow (capsule-moments.ts).
 * - The order of `placements` is the stacking order: later capsules rest on earlier ones (the pour drops the last).
 * - These are resting poses; with physics the scene drops the last capsules and lets them settle (capsule-physics.ts).
 */

/** How many capsules one connection becomes. The single place for this rule. */
export const CAPSULE_COUNT = {
  /** One capsule per this many minutes of connection time. */
  minutesPerCapsule: 10,
  /** Even a short connection leaves a small handful. */
  min: 3,
  /** A very long one stays a large handful, not a heap of its own (3 h and more). */
  max: 18,
} as const

export function capsulesForConnection(durationSeconds: number) {
  const count = Math.round(Math.max(0, durationSeconds) / 60 / CAPSULE_COUNT.minutesPerCapsule)
  return Math.min(CAPSULE_COUNT.max, Math.max(CAPSULE_COUNT.min, count))
}

export const PILE = {
  /**
   * Panel height in scene units: the camera shows exactly this height with the floor (y = 0) at the panel bottom; the
   * width follows the panel's shape. The mate is fitted to the panel's height, so in these units she always has the
   * same size, and the bins' walls can stay at fixed x.
   */
  viewHeight: 6.5,
  /** Default half width of the floor (scene units) when the panel's shape is not known yet. */
  defaultHalfWidth: 3.6,
  /**
   * Inner edge of the side bins (|x|, scene units): inside the mate's silhouette up to the bins' fill height (her
   * head-to-waist still covers |x| < ~1.95 there, measured on the hero render's alpha).
   */
  binEdge: 1.9,
  /** Narrowest side bin (scene units), for very narrow panels. */
  minSideWidth: 0.9,
  /** Fill height of the side bins (scene units, ≈ 30% of the panel): the capsules shrink as the count grows. */
  sideFill: 1.95,
  /** Share of the capsules in the two side bins together (the rest lie in the middle, behind her). */
  sideShare: 0.8,
  /** Height of the bins' (invisible) inner walls: above the panel's top, so a falling capsule stays in its bin. */
  binWallHeight: 20,
  /** Thickness of an inner wall, on the middle bin's side of `binEdge` (thick enough that nothing tunnels through). */
  binWallThickness: 0.3,
  /** Share of the pile's area the capsules fill (loose stacking). */
  packing: 0.6,
  /** Capsule length limits (scene units): hand-sized for a few, small but readable for hundreds. */
  maxLength: 0.62,
  minLength: 0.2,
  /** Spread of one bundle around its spot (scene units). */
  bundleSpread: 0.5,
  /** Width of one column of the height profile (scene units). */
  column: 0.0375,
  /** Largest in-plane tilt of a capsule at rest (radians). */
  maxTilt: 0.32,
} as const

/** Half width of the floor for a panel of this shape (width / height): the panel is `viewHeight` high. */
export function pileHalfWidth(aspect: number) {
  const half = (PILE.viewHeight * Math.max(0.1, aspect)) / 2
  return Math.max(PILE.binEdge + PILE.minSideWidth, Math.round(half * 50) / 50)
}

export type PileBin = { from: number; to: number; share: number }

/** The three bins (x ranges) of a floor `halfWidth` wide: left, middle, right, and the share of capsules each takes. */
export function pileBins(halfWidth: number = PILE.defaultHalfWidth): readonly PileBin[] {
  return [
    { from: -halfWidth, to: -PILE.binEdge, share: PILE.sideShare / 2 },
    { from: -PILE.binEdge + PILE.binWallThickness, to: PILE.binEdge - PILE.binWallThickness, share: 1 - PILE.sideShare },
    { from: PILE.binEdge, to: halfWidth, share: PILE.sideShare / 2 },
  ]
}

/** The bin a resting x lies in. */
export function pileBinAt(x: number, halfWidth: number = PILE.defaultHalfWidth) {
  const bins = pileBins(halfWidth)
  return bins.find((bin) => x >= bin.from && x <= bin.to) ?? bins[1]!
}

/** Area all capsules fill (scene units²): the two side bins up to `sideFill` make `sideShare` of it. */
export function pileArea(halfWidth: number = PILE.defaultHalfWidth) {
  const sideArea = 2 * (halfWidth - PILE.binEdge) * PILE.sideFill
  return sideArea / PILE.sideShare
}

/** Capsule length for a total count: the count fills the bins (`pileArea`) at `PILE.packing`. */
export function floorCapsuleLength(count: number, halfWidth: number = PILE.defaultHalfWidth) {
  if (count <= 0) return PILE.maxLength
  const length = Math.sqrt((PILE.packing * pileArea(halfWidth)) / (count * CAPSULE_ASPECT))
  // Steps of 0.01 so a new connection does not resize every capsule a hair.
  return Math.round(Math.min(PILE.maxLength, Math.max(PILE.minLength, length)) * 100) / 100
}

/** A keepsake capsule is this much larger than the others (its collision size follows). */
export const KEEPSAKE_SCALE = 1.4

export type FloorPlacement = CapsulePlacement & {
  /** Time band of the connection (its tint; the same for the whole bundle). */
  band: TimeBand
  /** The milestone (hours) this capsule marks, or 0 (capsule-moments.ts). */
  keepsake: number
  /** The connection (bundle) this capsule belongs to: the record id. */
  groupId: string
  /** Index of the bundle in `groups`. */
  group: number
}

export type FloorGroup = {
  id: string
  indices: number[]
  durationSeconds: number
  band: TimeBand
  /** The milestone (hours) of the bundle's keepsake capsule, or 0. */
  keepsake: number
}

export type FloorLayout = {
  kind: 'floor'
  placements: FloorPlacement[]
  groups: FloorGroup[]
  baseLength: number
  /** Highest point of any capsule. */
  topHeight: number
  /** Width of the floor (scene units, centred on x = 0): the panel's width at `PILE.viewHeight` high. */
  width: number
}

const CANDIDATES = 9

type Profile = { heights: Float64Array; cell: number; half: number }

const columnX = (profile: Profile, column: number) => -profile.half + (column + 0.5) * profile.cell

/**
 * Where a capsule (centre x, in-plane tilt, half axis, radius) comes to rest on the profile: the lowest centre height
 * at which no column of its outline dips into what already lies there (or the floor).
 */
function restOn(profile: Profile, x: number, tilt: number, halfAxis: number, radius: number) {
  const along = halfAxis * Math.cos(tilt)
  const slope = Math.tan(tilt)
  const from = Math.max(0, Math.floor((x - along - radius + profile.half) / profile.cell))
  const to = Math.min(profile.heights.length - 1, Math.floor((x + along + radius + profile.half) / profile.cell))
  let centerY = radius
  for (let column = from; column <= to; column++) {
    const cx = columnX(profile, column)
    const t = Math.min(x + along, Math.max(x - along, cx))
    const dx = Math.abs(cx - t)
    if (dx >= radius) continue
    const clearance = Math.sqrt(radius * radius - dx * dx)
    centerY = Math.max(centerY, profile.heights[column]! + clearance - (t - x) * slope)
  }
  return { centerY, from, to, along, slope }
}

function depositOn(profile: Profile, x: number, centerY: number, rest: ReturnType<typeof restOn>, radius: number) {
  for (let column = rest.from; column <= rest.to; column++) {
    const cx = columnX(profile, column)
    const t = Math.min(x + rest.along, Math.max(x - rest.along, cx))
    const dx = Math.abs(cx - t)
    if (dx >= radius) continue
    const top = centerY + (t - x) * rest.slope + Math.sqrt(radius * radius - dx * dx)
    if (top > profile.heights[column]!) profile.heights[column] = top
  }
}

function heightNear(profile: Profile, x: number, reach: number) {
  const from = Math.max(0, Math.floor((x - reach + profile.half) / profile.cell))
  const to = Math.min(profile.heights.length - 1, Math.floor((x + reach + profile.half) / profile.cell))
  let sum = 0
  for (let column = from; column <= to; column++) sum += profile.heights[column]!
  return sum / Math.max(1, to - from + 1)
}

/** `halfWidth`: half the panel's width in scene units (`pileHalfWidth` of its shape). */
export function layoutFloor(
  capsules: readonly CapsuleRecord[],
  { halfWidth = PILE.defaultHalfWidth }: { halfWidth?: number } = {},
): FloorLayout {
  const sorted = sortCapsules(capsules)
  const counts = sorted.map((capsule) => capsulesForConnection(capsule.durationSeconds))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const baseLength = floorCapsuleLength(total, halfWidth)
  const half = halfWidth
  const bins = pileBins(halfWidth)
  const columns = Math.ceil((2 * half) / PILE.column)
  const profile: Profile = { heights: new Float64Array(columns), cell: (2 * half) / columns, half }
  const placements: FloorPlacement[] = []
  const groups: FloorGroup[] = []
  let topHeight = 0
  const binPieces = bins.map(() => 0)
  const keepsakes = capsuleKeepsakes(sorted, capsulesForConnection)

  for (const [groupIndex, capsule] of sorted.entries()) {
    const random = seededRandom(hashId(capsule.id))
    // The bundle's bin: the one least full for its share (ties broken at random); its spot: the lowest of a few.
    // A bundle with a keepsake always goes to a side bin, so the keepsake shows beside the mate.
    const hasKeepsake = keepsakes.has(capsule.id)
    let bin = bins[1]!
    let binScore = Infinity
    for (const [index, candidate] of bins.entries()) {
      if (hasKeepsake && index === 1) continue
      const score = (binPieces[index]! + 1) / candidate.share + random() * 0.5
      if (score < binScore) {
        binScore = score
        bin = candidate
      }
    }
    binPieces[bins.indexOf(bin)]! += counts[groupIndex]!
    let spot = (bin.from + bin.to) / 2
    let spotScore = Infinity
    for (let attempt = 0; attempt < 5; attempt++) {
      const x = bin.from + random() * (bin.to - bin.from)
      const score = heightNear(profile, x, PILE.bundleSpread) + random() * 0.04
      if (score < spotScore) {
        spotScore = score
        spot = x
      }
    }
    const band = capsuleBand(capsule)
    const keepsake = keepsakes.get(capsule.id)
    const group: FloorGroup = {
      id: capsule.id,
      indices: [],
      durationSeconds: capsule.durationSeconds,
      band,
      keepsake: keepsake?.hours ?? 0,
    }
    groups.push(group)

    for (let piece = 0; piece < counts[groupIndex]!; piece++) {
      const isKeepsake = keepsake !== undefined && keepsake.piece === piece
      const variation = 0.88 + random() * 0.24
      const length = isKeepsake ? baseLength * KEEPSAKE_SCALE : baseLength * variation
      const radius = (length * CAPSULE_ASPECT) / 2
      const halfAxis = length / 2 - radius
      let best: { x: number; tilt: number; centerY: number; rest: ReturnType<typeof restOn> } | null = null
      let bestScore = Infinity
      for (let attempt = 0; attempt < CANDIDATES; attempt++) {
        const reach = PILE.bundleSpread * (1 + attempt * 0.25)
        // Inside the bundle's bin (a capsule never straddles a bin wall).
        const low = bin.from + length / 2 + 0.01
        const high = bin.to - length / 2 - 0.01
        const x = Math.max(low, Math.min(high, spot + (random() - 0.5) * 2 * reach))
        const tilt = (random() - 0.5) * 2 * PILE.maxTilt
        const rest = restOn(profile, x, tilt, halfAxis, radius)
        const top = rest.centerY + Math.abs(Math.sin(tilt)) * halfAxis + radius
        // Low and level wins: capsules fill hollows first. The keepsake also leans to the bin's outer side (away
        // from the mate, so she covers less of it).
        const outward = isKeepsake ? -Math.abs(x) * 0.35 : 0
        const score = top + Math.abs(tilt) * radius * 0.5 + random() * radius * 0.3 + outward
        if (score < bestScore) {
          bestScore = score
          best = { x, tilt, centerY: rest.centerY, rest }
        }
      }
      const chosen = best!
      depositOn(profile, chosen.x, chosen.centerY, chosen.rest, radius)
      topHeight = Math.max(topHeight, chosen.centerY + Math.abs(Math.sin(chosen.tilt)) * halfAxis + radius)
      group.indices.push(placements.length)
      placements.push({
        id: `${capsule.id}#${piece}`,
        index: placements.length,
        groupId: capsule.id,
        group: groupIndex,
        x: chosen.x,
        y: chosen.centerY,
        z: 0,
        yaw: 0,
        pitch: chosen.tilt,
        roll: random() * Math.PI * 2,
        length,
        radius,
        glow: isKeepsake ? 1 : 0.35 + random() * 0.45,
        band,
        keepsake: isKeepsake ? keepsake.hours : 0,
      })
    }
  }

  return { kind: 'floor', placements, groups, baseLength, topHeight, width: 2 * half }
}
