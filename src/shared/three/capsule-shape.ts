/**
 * The capsule's shape and colours without any renderer: proportions of the logo v2 capsule, the stadium profile and
 * the brand two tones. The WebGL pieces built on it are in `capsule-model.ts` (three.js, lazy chunks only).
 */

/** Logo v2 capsule: thickness / length = 159.90 / 364.04. */
export const CAPSULE_ASPECT = 159.9 / 364.04
/** Logo v2 seam: ellipse centre sits 21.34 of 182.02 along the axis from the centre, toward the short half. */
export const CAPSULE_SEAM_OFFSET = 21.34 / 182.02
/** Seam position on the unit-length capsule axis (+x is the tinted half). */
export const CAPSULE_SEAM_X = CAPSULE_SEAM_OFFSET * 0.5

const UNIT_RADIUS = CAPSULE_ASPECT / 2

/** Radius of the unit-length stadium capsule at axis position x (−0.5…0.5). */
export function capsuleRadiusAt(x: number) {
  const straight = 0.5 - UNIT_RADIUS
  const beyond = Math.abs(x) - straight
  return beyond <= 0 ? UNIT_RADIUS : Math.sqrt(Math.max(0, UNIT_RADIUS * UNIT_RADIUS - beyond * beyond))
}

/**
 * Axis positions (−0.5…0.5) the lathe samples for the part [fromX, toX]: the seam edges, both ends of the straight
 * body, 15 steps around each round end and 5 along the body.
 */
export function capsuleProfileSamples(fromX: number, toX: number) {
  const straight = 0.5 - UNIT_RADIUS
  const samples = new Set<number>([fromX, toX, CAPSULE_SEAM_X - 0.004, CAPSULE_SEAM_X + 0.004, -straight, straight])
  for (let step = 0; step <= 14; step++) {
    const angle = (step / 14) * (Math.PI / 2)
    samples.add(-straight - UNIT_RADIUS * Math.cos(angle))
    samples.add(straight + UNIT_RADIUS * Math.cos(angle))
  }
  for (let step = 1; step < 6; step++) samples.add(-straight + (2 * straight * step) / 6)
  return [...samples].filter((x) => x >= fromX - 1e-9 && x <= toX + 1e-9).sort((a, b) => a - b)
}

/** The capsule's colours as the glass uses them. Every value is a CSS hex colour. */
export type CapsuleColors = {
  /** Frosted half (logo v2 body). */
  lightHalf: string
  /** Tinted half (logo v2 seam purple). */
  tintHalf: string
  /** The light inside and around it. */
  glow: string
}

/**
 * The brand capsule (채린's colours in 내 메이트, logo v2: white → #D4C3FA body, #B397FC → #8053F2 seam) — the one
 * capsule every screen shows: the invite dome and strip, the attendance reward, the mate detail and the empty records.
 */
export const BRAND_CAPSULE_COLORS: CapsuleColors = {
  lightHalf: '#EEE9FF',
  tintHalf: '#C4B0FF',
  glow: '#B9A3FB',
}
