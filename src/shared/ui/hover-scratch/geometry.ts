export type Point = { x: number; y: number }

/** Count alpha rather than pointer distance: retracing a stroke adds no extra area. */
export function erasedFraction(pixels: Uint8ClampedArray) {
  if (pixels.length === 0) return 0
  let remaining = 0
  for (let i = 3; i < pixels.length; i += 4) remaining += pixels[i] ?? 0
  return 1 - remaining / ((pixels.length / 4) * 255)
}

/** Farthest any spot of the frame lies from its nearest point, sampled on a grid with margin. */
export function coverageRadius(points: readonly Point[], width: number, height: number) {
  const cols = 24
  const rows = 12
  let reach = 0
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols) * width
      const y = (row / rows) * height
      let nearest = Infinity
      for (const point of points) nearest = Math.min(nearest, Math.hypot(point.x - x, point.y - y))
      reach = Math.max(reach, nearest)
    }
  }
  // Half a cell diagonal covers spots between samples.
  return reach + Math.hypot(width / cols, height / rows) / 2
}

/** Deterministic per-seed spread rate in [0.7, 1.3], so blooms grow unevenly like wet paint. */
export const MIN_SPREAD_RATE = 0.7
export function spreadRate(index: number) {
  const hash = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return MIN_SPREAD_RATE + (hash - Math.floor(hash)) * 2 * (1 - MIN_SPREAD_RATE)
}

/** Field level where the ink edge sits before noise shifts it. */
export const INK_EDGE = 0.32
/** How far edge noise moves that level; large enough for ragged lobes and small holes. */
export const INK_ROUGHNESS = 0.9
export const INK_SOFTNESS = 0.035

/**
 * Cover alpha (0 revealed, 1 covered) for a brush field in [0, 1] and edge noise in [0, 1].
 * A hard but antialiased threshold keeps the torn-ink silhouette instead of a soft spotlight;
 * a wider `softness` gives the translucent fringe of a wet bloom.
 */
export function coverAlpha(
  field: number,
  noise: number,
  roughness = INK_ROUGHNESS,
  softness = INK_SOFTNESS,
) {
  // Noise fades out where the brush never reached, so untouched cover can never open.
  const value = field + (noise - 0.5) * roughness * Math.min(1, field * 4)
  const t = Math.min(1, Math.max(0, (value - INK_EDGE + softness) / (2 * softness)))
  return 1 - t * t * (3 - 2 * t)
}

/** Share of the restore during which later strokes wait for older ones to start receding. */
export const RESTORE_STAGGER = 0.55

/**
 * Strength of a stroke while the reveal restores. `order` is 0 for the oldest stroke and 1 for
 * the newest, so the trail retreats toward where the pointer rested and ends fully covered.
 */
export function restoreStrength(start: number, order: number, elapsed: number, duration: number) {
  const begin = order * duration * RESTORE_STAGGER
  const t = Math.min(1, Math.max(0, (elapsed - begin) / (duration * (1 - RESTORE_STAGGER))))
  return start * (1 - t)
}

function lattice(ix: number, iy: number, seed: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const top = lattice(ix, iy, seed) + (lattice(ix + 1, iy, seed) - lattice(ix, iy, seed)) * sx
  const bottom =
    lattice(ix, iy + 1, seed) + (lattice(ix + 1, iy + 1, seed) - lattice(ix, iy + 1, seed)) * sx
  return top + (bottom - top) * sy
}

const OCTAVES = [
  [0.8, 0.55],
  [0.4, 0.3],
  [0.2, 0.15],
] as const

/**
 * Fractal value noise in [0, 1] for a `cols`×`rows` mask stretched over `width`×`height` CSS px.
 * Cells are sized in CSS px relative to the brush, so lobes stay round on any banner aspect.
 */
export function fractalNoise(
  cols: number,
  rows: number,
  width: number,
  height: number,
  brushSize: number,
  seed: number,
) {
  const noise = new Float32Array(cols * rows)
  const sx = width / cols
  const sy = height / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = (x + 0.5) * sx
      const v = (y + 0.5) * sy
      let sum = 0
      for (const [scale, weight] of OCTAVES) {
        const cell = brushSize * scale
        sum += valueNoise(u / cell, v / cell, seed + cell) * weight
      }
      noise[y * cols + x] = sum
    }
  }
  return noise
}
