/**
 * Shared, renderer-free pieces of the capsule scene: capsule proportions and the placement type the pile layout
 * produces (capsule-floor-layout.ts). How many capsules a connection becomes is `CAPSULE_COUNT` there; progress
 * is the mate's affinity stage (affinity-progress.ts), not a time scale of the scene.
 */

/** Logo v2 proportions, shared with every capsule scene (src/shared/three/capsule-shape.ts). */
export { CAPSULE_ASPECT, CAPSULE_SEAM_OFFSET } from '../../../shared/three/capsule-shape.ts'

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
