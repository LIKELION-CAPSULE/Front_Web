/**
 * Shared, renderer-free pieces of the capsule scene: capsule proportions and the height-field stacking the floor
 * layout uses (capsule-floor-layout.ts). How many capsules a connection becomes is `CAPSULE_COUNT` there; progress
 * is the mate's affinity stage (affinity-progress.ts), not a time scale of the scene.
 */

/** Logo v2 capsule: thickness / length = 159.90 / 364.04. */
export const CAPSULE_ASPECT = 159.9 / 364.04
/** Logo v2 seam: ellipse centre sits 21.34 of 182.02 along the axis from the centre, toward the short half. */
export const CAPSULE_SEAM_OFFSET = 21.34 / 182.02

export type CapsulePlacement = {
  id: string
  index: number
  x: number
  y: number
  z: number
  /** Rotation of the capsule axis around +y. */
  yaw: number
  /** Slope of the capsule axis (radians, + lifts the far end). */
  pitch: number
  /** Rotation around the capsule's own axis. */
  roll: number
  /** Full length and radius. */
  length: number
  radius: number
  /** 0…1 relative glow of the core (a small natural variation). */
  glow: number
}

// ── Height field ──────────────────────────────────────────────────────────────

const CELL = 0.035
const MAX_SLOPE = 0.45
const SLOPES = Array.from({ length: 11 }, (_, index) => -MAX_SLOPE + (index / 10) * 2 * MAX_SLOPE)
const AXIS_SAMPLES = 7

export type Field = {
  heights: Float32Array
  grid: number
  half: number
}

/** Height field over the square [-half, half]²; `floor` gives the starting height (Infinity = unreachable). */
export function heightField(half: number, floor: (x: number, z: number) => number): Field {
  const grid = Math.ceil((2 * half) / CELL)
  const heights = new Float32Array(grid * grid)
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      heights[i * grid + j] = floor(-half + (i + 0.5) * CELL, -half + (j + 0.5) * CELL)
    }
  }
  return { heights, grid, half }
}

/** Visits grid cells within `radius` of the segment a→b (xz plane); `t` is the 0…1 position along the segment. */
export function forEachCellNearSegment(
  field: Field, ax: number, az: number, bx: number, bz: number, radius: number,
  visit: (cell: number, distance: number, t: number) => void,
) {
  const { grid, half } = field
  const minX = Math.max(0, Math.floor((Math.min(ax, bx) - radius + half) / CELL))
  const maxX = Math.min(grid - 1, Math.floor((Math.max(ax, bx) + radius + half) / CELL))
  const minZ = Math.max(0, Math.floor((Math.min(az, bz) - radius + half) / CELL))
  const maxZ = Math.min(grid - 1, Math.floor((Math.max(az, bz) + radius + half) / CELL))
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz || 1e-9
  for (let i = minX; i <= maxX; i++) {
    const x = -half + (i + 0.5) * CELL
    for (let j = minZ; j <= maxZ; j++) {
      const z = -half + (j + 0.5) * CELL
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
      const px = ax + dx * t - x
      const pz = az + dz * t - z
      const distance = Math.sqrt(px * px + pz * pz)
      if (distance < radius) visit(i * grid + j, distance, t)
    }
  }
}

export type Pose = { x: number; z: number; yaw: number; centerY: number; slope: number }

/** Lowest resting pose of a capsule whose axis projects to the given xz segment. */
export function restingPose(field: Field, x: number, z: number, yaw: number, halfAxis: number, radius: number): Pose {
  const ux = Math.cos(yaw)
  const uz = -Math.sin(yaw)
  const sampleT: number[] = []
  const sampleY: number[] = []
  for (let s = 0; s < AXIS_SAMPLES; s++) {
    const t = -1 + (2 * s) / (AXIS_SAMPLES - 1)
    const sx = x + ux * halfAxis * t
    const sz = z + uz * halfAxis * t
    let required = radius
    forEachCellNearSegment(field, sx, sz, sx, sz, radius, (cell, distance) => {
      const top = field.heights[cell]! + Math.sqrt(radius * radius - distance * distance)
      if (top > required) required = top
    })
    sampleT.push(t * halfAxis)
    sampleY.push(required)
  }
  let best = { centerY: Infinity, slope: 0 }
  for (const slope of SLOPES) {
    let centerY = -Infinity
    for (let s = 0; s < AXIS_SAMPLES; s++) centerY = Math.max(centerY, sampleY[s]! - slope * sampleT[s]!)
    if (centerY < best.centerY - 1e-4 || (Math.abs(centerY - best.centerY) <= 1e-4 && Math.abs(slope) < Math.abs(best.slope))) {
      best = { centerY, slope }
    }
  }
  return { x, z, yaw, centerY: best.centerY, slope: best.slope }
}

export function deposit(field: Field, pose: Pose, halfAxis: number, radius: number) {
  const ux = Math.cos(pose.yaw)
  const uz = -Math.sin(pose.yaw)
  forEachCellNearSegment(
    field,
    pose.x - ux * halfAxis, pose.z - uz * halfAxis, pose.x + ux * halfAxis, pose.z + uz * halfAxis,
    radius,
    (cell, distance, t) => {
      const axisY = pose.centerY + pose.slope * halfAxis * (2 * t - 1)
      const top = axisY + Math.sqrt(radius * radius - distance * distance)
      if (top > field.heights[cell]!) field.heights[cell] = top
    },
  )
}
