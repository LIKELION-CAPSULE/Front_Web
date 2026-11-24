import { hashId, seededRandom, sortCapsules } from './capsule-jar-data.ts'
import {
  CAPSULE_ASPECT,
  deposit,
  heightField,
  restingPose,
  type CapsulePlacement,
  type Field,
  type Pose,
} from './capsule-jar-layout.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

/**
 * Pure layout of the capsule floor at the bottom of the mate panel (the mate stands in front of it). No renderer
 * imports, so it runs in unit tests.
 *
 * - One connection is a *bundle* of capsules, as many as its length (`capsulesForConnection`): 30 min → 3,
 *   1 h → 6, 2 h → 12. The amount shows the time; the size of the capsules does not (only a small natural variation
 *   inside a bundle).
 * - Bundles land around their own spot, so a bundle reads as a little cluster; together they make one low mound.
 *   Few land right in the middle, where the mate stands in front and would hide them.
 * - The spread grows with the number of capsules (and the capsules shrink in steps for large numbers), so 30 or 300
 *   capsules both fill the floor.
 * - The order of `placements` is the stacking order: later capsules rest on earlier ones (the pour drops the last).
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

export const FLOOR = {
  /** The middle of the floor right behind the mate (half extents): bundles mostly land around it. */
  standHalfWidth: 0.78,
  standHalfDepth: 1.4,
  /** Smallest spread, so even a few capsules lie beside the mate instead of only behind her. */
  minRadius: 1.9,
  maxRadius: 3.4,
  /** Average layers the pile is thick (sets how wide it spreads for a number of capsules). */
  layers: 1.25,
  /** Height a capsule pays per unit of distance from the middle: a gentle mound. */
  slope: 0.22,
  /** Spread of one bundle around its spot. */
  bundleSpread: 0.55,
  /** The pile stays low: about this many capsule layers (more costs a lot). */
  maxLayers: 3.2,
  /** The floor is an ellipse, wider than deep (the view is landscape and seen at an angle). */
  aspectX: 1.22,
  aspectZ: 0.86,
  /** Share of bundles landing in the middle anyway (one connected mound); the rest stay in sight beside the mate. */
  middleShare: 0.15,
} as const

/** Average pile height in a square around (x, z). */
function heightAround(field: Field, x: number, z: number, reach: number) {
  const { grid, half, heights } = field
  const cell = (2 * half) / grid
  const steps = 4
  let sum = 0
  let count = 0
  for (let a = -steps; a <= steps; a++) {
    for (let b = -steps; b <= steps; b++) {
      const i = Math.floor((x + (a / steps) * reach + half) / cell)
      const j = Math.floor((z + (b / steps) * reach + half) / cell)
      if (i < 0 || j < 0 || i >= grid || j >= grid) continue
      sum += heights[i * grid + j]!
      count++
    }
  }
  return count ? sum / count : 0
}

/** Inside the middle of the floor behind the mate, grown by `margin`. */
function insideMiddle(x: number, z: number, margin: number) {
  return Math.abs(x) < FLOOR.standHalfWidth + margin && Math.abs(z) < FLOOR.standHalfDepth + margin
}

/** Capsule length by the total number of capsules: hand-sized beside the mate, smaller steps for big piles. */
const SIZE_STEPS: readonly (readonly [maxCount: number, length: number])[] = [
  [60, 0.62],
  [120, 0.55],
  [200, 0.48],
  [300, 0.43],
  [Infinity, 0.39],
]

export function floorCapsuleLength(count: number) {
  for (const [maxCount, length] of SIZE_STEPS) if (count <= maxCount) return length
  return SIZE_STEPS[SIZE_STEPS.length - 1]![1]
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
  /** Radius the capsules spread over (around the centre). */
  spreadRadius: number
}

const CANDIDATES = 9

function spreadFor(count: number, length: number) {
  const footprint = length * length * CAPSULE_ASPECT
  const middleArea = 4 * FLOOR.standHalfWidth * FLOOR.standHalfDepth * 0.5
  const area = (count * footprint) / FLOOR.layers + middleArea
  return Math.min(FLOOR.maxRadius, Math.max(FLOOR.minRadius, Math.sqrt(area / (Math.PI * FLOOR.aspectX * FLOOR.aspectZ))))
}

export function layoutFloor(capsules: readonly CapsuleRecord[]): FloorLayout {
  const sorted = sortCapsules(capsules)
  const counts = sorted.map((capsule) => capsulesForConnection(capsule.durationSeconds))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const baseLength = floorCapsuleLength(total)
  const spreadRadius = spreadFor(total, baseLength)
  const half = spreadRadius * FLOOR.aspectX + 0.6
  const field: Field = heightField(half, () => 0)
  const placements: FloorPlacement[] = []
  const groups: FloorGroup[] = []
  let topHeight = 0

  for (const [groupIndex, capsule] of sorted.entries()) {
    const random = seededRandom(hashId(capsule.id))
    // The bundle's spot on the floor (an ellipse, wider than deep like the view). Most bundles land beside and
    // behind the mate's place so they stay in sight; a few land in the middle and join the heap up.
    // Of a few random spots the emptiest wins, so bundles spread over the floor instead of piling on one another.
    const under = random() < FLOOR.middleShare
    let spotX = 0
    let spotZ = 0
    let spotScore = Infinity
    for (let attempt = 0; attempt < 7; attempt++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random())
      const x = Math.sin(angle) * distance * spreadRadius * FLOOR.aspectX * 0.9
      const z = Math.cos(angle) * distance * spreadRadius * FLOOR.aspectZ * 0.9
      if (!under && insideMiddle(x, z, 0.1)) continue
      const score = heightAround(field, x, z, FLOOR.bundleSpread) + random() * 0.05
      if (score < spotScore) {
        spotScore = score
        spotX = x
        spotZ = z
      }
    }
    const group: FloorGroup = { id: capsule.id, indices: [], durationSeconds: capsule.durationSeconds }
    groups.push(group)

    for (let piece = 0; piece < counts[groupIndex]!; piece++) {
      const length = baseLength * (0.88 + random() * 0.24)
      const radius = (length * CAPSULE_ASPECT) / 2
      const halfAxis = length / 2 - radius
      const outer = spreadRadius - length / 2
      const ceiling = FLOOR.maxLayers * 2 * radius
      let best: Pose | null = null
      let bestScore = Infinity
      for (let attempt = 0; attempt < CANDIDATES; attempt++) {
        const angle = random() * Math.PI * 2
        const reach = FLOOR.bundleSpread * Math.sqrt(random()) * (1 + attempt * 0.25)
        let x = spotX + Math.sin(angle) * reach
        let z = spotZ + Math.cos(angle) * reach
        const ellipse = Math.hypot(x / FLOOR.aspectX, z / FLOOR.aspectZ) || 1
        if (ellipse > outer) {
          x *= outer / ellipse
          z *= outer / ellipse
        }
        const pose = restingPose(field, x, z, random() * Math.PI, halfAxis, radius)
        if (!Number.isFinite(pose.centerY)) continue
        const top = pose.centerY + Math.abs(pose.slope) * halfAxis + radius
        const score =
          top + FLOOR.slope * Math.hypot(pose.x / FLOOR.aspectX, pose.z / FLOOR.aspectZ) + random() * radius * 0.4 +
          (!under && insideMiddle(pose.x, pose.z, -0.05) ? 0.6 : 0) +
          Math.max(0, top - ceiling) * 4
        if (score < bestScore) {
          best = pose
          bestScore = score
        }
      }
      const pose = best ?? restingPose(field, spotX, spotZ, 0, halfAxis, radius)
      deposit(field, pose, halfAxis, radius)
      topHeight = Math.max(topHeight, pose.centerY + Math.abs(pose.slope) * halfAxis + radius)
      group.indices.push(placements.length)
      placements.push({
        id: `${capsule.id}#${piece}`,
        index: placements.length,
        groupId: capsule.id,
        group: groupIndex,
        x: pose.x,
        y: pose.centerY,
        z: pose.z,
        yaw: pose.yaw,
        pitch: Math.atan(pose.slope),
        roll: random() * Math.PI * 2,
        length,
        radius,
        glow: 0.35 + random() * 0.45,
      })
    }
  }

  return {
    kind: 'floor',
    placements,
    groups,
    baseLength,
    topHeight,
    spreadRadius,
  }
}
