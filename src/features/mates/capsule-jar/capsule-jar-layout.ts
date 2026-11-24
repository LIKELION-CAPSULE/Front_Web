/**
 * Shared, renderer-free pieces of the capsule scene: capsule proportions and the placement type the pile layout
 * produces (capsule-floor-layout.ts). How many capsules a connection becomes is `CAPSULE_COUNT` there; progress
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
  /** Rotation of the capsule axis around +y (0 in the side-on 2D pile). */
  yaw: number
  /** Tilt of the capsule axis within the screen plane (radians, + lifts the +x end). */
  pitch: number
  /** Rotation around the capsule's own axis. */
  roll: number
  /** Full length and radius. */
  length: number
  radius: number
  /** 0…1 relative glow of the core (a small natural variation). */
  glow: number
}
