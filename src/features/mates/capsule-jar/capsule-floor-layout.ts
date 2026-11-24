import { hashId, seededRandom, sortCapsules } from './capsule-jar-data.ts'
import { CAPSULE_ASPECT, type CapsulePlacement } from './capsule-jar-layout.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

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
  /** Panel width in scene units: the camera shows exactly this width, the floor is y = 0 at the panel bottom. */
  width: 6,
  /** Inner edge of the side bins (|x|, scene units): inside the mate's silhouette at the bins' height. */
  binEdge: 1.75,
  /** Fill height of the side bins (scene units): the capsules shrink as the count grows to keep it. */
  sideFill: 3,
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
  /** Columns of the height profile across the width. */
  columns: 160,
  /** Largest in-plane tilt of a capsule at rest (radians). */
  maxTilt: 0.32,
} as const

/** Area all capsules fill (scene units²): the two side bins up to `sideFill` make `sideShare` of it. */
export function pileArea() {
  const sideArea = 2 * (PILE.width / 2 - PILE.binEdge) * PILE.sideFill
  return sideArea / PILE.sideShare
}

/** The three bins (x ranges), left, middle, right, and the share of the capsules each takes. */
export const PILE_BINS: readonly { from: number; to: number; share: number }[] = [
  { from: -PILE.width / 2, to: -PILE.binEdge, share: PILE.sideShare / 2 },
  { from: -PILE.binEdge + PILE.binWallThickness, to: PILE.binEdge - PILE.binWallThickness, share: 1 - PILE.sideShare },
  { from: PILE.binEdge, to: PILE.width / 2, share: PILE.sideShare / 2 },
]

/** The bin a resting x lies in. */
export function pileBinAt(x: number) {
  return PILE_BINS.find((bin) => x >= bin.from && x <= bin.to) ?? PILE_BINS[1]!
}

/** Capsule length for a total count: the count fills the bins (`pileArea`) at `PILE.packing`. */
export function floorCapsuleLength(count: number) {
  if (count <= 0) return PILE.maxLength
  const length = Math.sqrt((PILE.packing * pileArea()) / (count * CAPSULE_ASPECT))
  // Steps of 0.01 so a new connection does not resize every capsule a hair.
  return Math.round(Math.min(PILE.maxLength, Math.max(PILE.minLength, length)) * 100) / 100
}

export type FloorPlacement = CapsulePlacement & {
  /** The connection (bundle) this capsule belongs to: the record id. */
  groupId: string
  /** Index of the bundle in `groups`. */
  group: number
}

export type FloorGroup = { id: string; indices: number[]; durationSeconds: number }

export type FloorLayout = {
  kind: 'floor'
  placements: FloorPlacement[]
  groups: FloorGroup[]
  baseLength: number
  /** Highest point of any capsule. */
  topHeight: number
  /** Width of the floor (scene units, centred on x = 0). */
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

export function layoutFloor(capsules: readonly CapsuleRecord[]): FloorLayout {
  const sorted = sortCapsules(capsules)
  const counts = sorted.map((capsule) => capsulesForConnection(capsule.durationSeconds))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const baseLength = floorCapsuleLength(total)
  const half = PILE.width / 2
  const profile: Profile = { heights: new Float64Array(PILE.columns), cell: PILE.width / PILE.columns, half }
  const placements: FloorPlacement[] = []
  const groups: FloorGroup[] = []
  let topHeight = 0
  const binPieces = PILE_BINS.map(() => 0)

  for (const [groupIndex, capsule] of sorted.entries()) {
    const random = seededRandom(hashId(capsule.id))
    // The bundle's bin: the one least full for its share (ties broken at random); its spot: the lowest of a few.
    let bin = PILE_BINS[1]!
    let binScore = Infinity
    for (const [index, candidate] of PILE_BINS.entries()) {
      const score = (binPieces[index]! + 1) / candidate.share + random() * 0.5
      if (score < binScore) {
        binScore = score
        bin = candidate
      }
    }
    binPieces[PILE_BINS.indexOf(bin)]! += counts[groupIndex]!
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
    const group: FloorGroup = { id: capsule.id, indices: [], durationSeconds: capsule.durationSeconds }
    groups.push(group)

    for (let piece = 0; piece < counts[groupIndex]!; piece++) {
      const length = baseLength * (0.88 + random() * 0.24)
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
        // Low and level wins: capsules fill hollows first.
        const score = top + Math.abs(tilt) * radius * 0.5 + random() * radius * 0.3
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
        glow: 0.35 + random() * 0.45,
      })
    }
  }

  return { kind: 'floor', placements, groups, baseLength, topHeight, width: PILE.width }
}
