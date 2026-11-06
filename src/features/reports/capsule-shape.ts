/** Shared dimensions for the card-opening capsule and the study-start capsule. No renderer imports. */
export const CAPSULE_RADIUS = .34
export const CAPSULE_CAP_RADIUS = CAPSULE_RADIUS * 1.04
export const CAPSULE_SEAM_Y = -.12
const CENTER = .62

export const CAPSULE_SHAPE = {
  radius: CAPSULE_RADIUS,
  capRadius: CAPSULE_CAP_RADIUS,
  center: CENTER,
  bodyRim: .32,
  capRim: CAPSULE_SEAM_Y,
  minY: -CENTER - CAPSULE_RADIUS,
  maxY: CENTER + CAPSULE_CAP_RADIUS,
  length: 2 * CENTER + CAPSULE_RADIUS + CAPSULE_CAP_RADIUS,
} as const
