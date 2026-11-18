/**
 * Tunable values for the 3D usage guide. Progress runs from 0 (the guide opens) to 1 (scrolled to the end).
 * Kept free of three.js so the timing can be tested and imported without loading the scene.
 */
export const GUIDE = {
  /** Scroll length of the whole guide, in viewport heights. */
  scrollLength: 4,
  /** Step 1: the desk turns left to face the camera. */
  rotateEnd: 0.25,
  /** Step 2: the camera moves in to the monitor. */
  zoomStart: 0.3,
  zoomEnd: 0.55,
  /** Step 3: the camera pulls back and the notebook and pencil come forward. */
  focusStart: 0.6,
  focusEnd: 0.8,
  /** Step 4: a last gentle pull back. */
  finishStart: 0.85,
  /** How far the desk starts turned to the right, in degrees; it turns left to 0. */
  rotateDeg: 32,
  /** Radius of the turn around a pivot in front of the desk, in world units (larger sweeps wider). */
  pivotRadius: 2.4,
  /** Exponential smoothing rate per second; higher follows the scroll more tightly. */
  damping: 6,
  /** Vertical field of view in degrees. */
  fov: 30,
  /** Monitor screen height in world units; its width follows the viewport aspect. */
  screenHeight: 0.62,
  /** Camera distance from the screen while the desk turns. */
  farDistance: 3.3,
  /** Share of the view height the screen fills at the end of step 2. */
  zoomFill: 0.58,
  /** Camera distance in step 3, and how much further it backs off in step 4. */
  focusDistance: 3,
  finishPullBack: 0.25,
  /** Camera height above the screen centre while turning, and in step 3. */
  cameraLift: 0.55,
  focusLift: 0.3,
  /** Share of the viewport width the whole scene sits right of centre, leaving the left for the copy. */
  sceneShift: 0.15,
  /** Size of the floating notebook and pencil, and how much larger they get in step 3. */
  floatScale: 1,
  focusFloatScale: 0.8,
  /** How dark the monitor gets while the notebook is highlighted (0 none, 1 black). */
  focusScreenDim: 0.45,
} as const

/** Scroll timing per step (same order as `GUIDE_STEPS`): where its copy takes over and where its scene settles. */
export const GUIDE_STEP_RANGES = [
  { from: 0, settle: GUIDE.rotateEnd },
  { from: GUIDE.zoomStart, settle: GUIDE.zoomEnd },
  { from: GUIDE.focusStart, settle: GUIDE.focusEnd },
  { from: GUIDE.finishStart, settle: 1 },
] as const

/** Point colours for the floating objects: the capsule's lavender cap over its purple body. */
export const GUIDE_COLORS = { purple: '#7C5CFF', lavender: '#B9A6FF', paper: '#F4F1FF', ink: '#5B3FD9' } as const

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t
/** 0 before `start`, 1 after `end`, linear between. */
export const segment = (value: number, start: number, end: number) =>
  end <= start ? (value >= end ? 1 : 0) : clamp01((value - start) / (end - start))
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** Index of the step whose copy is showing at `progress`. */
export function stepAt(progress: number) {
  let index = 0
  GUIDE_STEP_RANGES.forEach((range, i) => {
    if (progress >= range.from) index = i
  })
  return index
}

/** Camera distance at which a screen of `screenHeight` exactly fills the vertical field of view. */
export function fillDistance(screenHeight: number = GUIDE.screenHeight, fov: number = GUIDE.fov) {
  return screenHeight / 2 / Math.tan((fov * Math.PI) / 360)
}

export type GuidePose = {
  /** Desk turn around the vertical axis, radians. */
  yaw: number
  cameraDistance: number
  cameraHeight: number
  /** Floating notebook and pencil, in camera space as a share of the half view (x right, y up). */
  floatX: number
  floatY: number
  floatTurn: number
  floatScale: number
  /** 0–1 darkening of the monitor picture. */
  screenDim: number
  /** Which monitor picture shows: 0 rooms, 1 study with a companion, 2 affection and capsule card. */
  screenStep: number
}

/** Scene pose for a (smoothed) progress in [0, 1]. */
export function guidePose(progress: number, guide = GUIDE): GuidePose {
  const p = clamp01(progress)
  const turn = easeInOutCubic(segment(p, 0, guide.rotateEnd))
  const zoom = easeInOutCubic(segment(p, guide.zoomStart, guide.zoomEnd))
  const focus = easeInOutCubic(segment(p, guide.focusStart, guide.focusEnd))
  const finish = easeInOutCubic(segment(p, guide.finishStart, 1))
  const near = fillDistance(guide.screenHeight, guide.fov) / guide.zoomFill
  // Each phase starts from where the previous one left off.
  const floatX = lerp(lerp(lerp(0.1, 0.55, turn), 1.05, zoom), -0.54, focus)
  const floatY = lerp(lerp(lerp(0.06, 0.2, turn), 0.7, zoom), -0.44, focus)
  return {
    yaw: (guide.rotateDeg * Math.PI) / 180 * (1 - turn),
    cameraDistance: lerp(lerp(guide.farDistance, near, zoom), guide.focusDistance, focus) + guide.finishPullBack * finish,
    cameraHeight: lerp(guide.cameraLift * (1 - zoom), guide.focusLift, focus),
    floatX,
    floatY: floatY + 0.04 * finish,
    floatTurn: lerp(lerp(-0.45, 0.3, turn) + zoom * 0.8, 0.35, focus),
    floatScale: guide.floatScale * lerp(lerp(1, 0.72, turn) * lerp(1, 0.8, zoom), guide.focusFloatScale, focus),
    screenDim: guide.focusScreenDim * focus * (1 - finish),
    screenStep: p < guide.zoomStart + (guide.zoomEnd - guide.zoomStart) * 0.35 ? 0 : p < guide.focusStart ? 1 : 2,
  }
}

/** Frame-rate independent exponential approach of `current` toward `target`. */
export function damp(current: number, target: number, rate: number, seconds: number) {
  const next = target + (current - target) * Math.exp(-rate * seconds)
  return Math.abs(next - target) < 1e-4 ? target : next
}
