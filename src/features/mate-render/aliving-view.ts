/**
 * Shared Aliving2D view projection & A/B camera framing math for chaerin-v2 (1280×1280 model canvas).
 * Used by both AlivingRenderer (`setView`) and AssembleMateStage (9-layer overlay & camera rig)
 * so WebGL and DOM layers overlap pixel-for-pixel at every viewport size.
 */

export const ALIVING_MODEL_SIZE = 1280
export const ALIVING_ASSET_SCALE = 3

/** Chaerin-v2 vertical landmarks in 1280×1280 model pixels (model has no legs below skirt hem). */
export const CHAERIN_V2_LANDMARKS = {
  centerX: 640,
  headTopY: 31,
  eyesY: 238,
  waistY: 769,
  skirtHemY: 1160,
  fingertipY: 1247,
} as const

export interface AlivingView {
  zoom: number
  cx: number
  cy: number
}

export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
}

export interface CameraTransform {
  tx: number
  ty: number
  scale: number
}

export interface AssembleCameraPlan {
  /** Oversized inner camera wrapper width (= cw / sA) so Shot A fits fully while Shot B renders at native 1:1. */
  cameraW: number
  cameraH: number
  /** Offset of the oversized wrapper inside the stage so its center sits at (cw/2, ch/2). */
  offsetLeft: number
  offsetTop: number
  /** `setView(zoom, cx, cy)` passed to AlivingRenderer & used for layer placement inside `.assemble-camera`. */
  view: AlivingView
  /** Model-px-to-CSS-px scale in Shot A (full shot) and Shot B (medium shot). */
  kA: number
  kB: number
  shotA: CameraTransform
  shotB: CameraTransform
  shotExplode: CameraTransform
}

/**
 * Exact projection matching `engine.js` `setView(zoom, cx, cy)`:
 * `k = min(cw, ch) / 1280 * zoom`
 * `screen = (cw/2 + (mx - cx) * k, ch/2 + (my - cy) * k)`
 */
export function modelPointToScreen(
  mx: number,
  my: number,
  cw: number,
  ch: number,
  view: AlivingView,
  modelSize = ALIVING_MODEL_SIZE,
): { x: number; y: number; k: number } {
  const k = (Math.min(cw, ch) / modelSize) * view.zoom
  return {
    x: cw / 2 + (mx - view.cx) * k,
    y: ch / 2 + (my - view.cy) * k,
    k,
  }
}

/**
 * Converts a 3× manifest box (3840×3840) to CSS pixel coordinates inside a container of size (cw, ch)
 * using the exact Aliving2D `setView(zoom, cx, cy)` projection.
 */
export function computeAlivingLayerBox(
  box3x: { x: number; y: number; width: number; height: number },
  cw: number,
  ch: number,
  view: AlivingView,
  assetScale = ALIVING_ASSET_SCALE,
): ScreenBox {
  const mx = box3x.x / assetScale
  const my = box3x.y / assetScale
  const mw = box3x.width / assetScale
  const mh = box3x.height / assetScale
  const pt = modelPointToScreen(mx, my, cw, ch, view)
  return {
    left: pt.x,
    top: pt.y,
    width: mw * pt.k,
    height: mh * pt.k,
  }
}

/**
 * Computes Shot A (full shot: head top at 6% height, skirt hem y=1160 at exact 100% bottom),
 * Shot B (medium shot: eyes y=238 at 30% height, ~1.35× Shot A, waist near bottom),
 * and the oversized `.assemble-camera` plan so Shot B renders at native 1:1 sharpness
 * while Shot A never clips the skirt hem.
 */
export function computeAssembleCamera(cw: number, ch: number): AssembleCameraPlan {
  const { centerX, headTopY, eyesY, skirtHemY } = CHAERIN_V2_LANDMARKS
  const topMarginRatio = 0.06
  const bOverARatio = 1.35

  // Shot A: headTopY -> 0.06 * ch, skirtHemY -> 1.00 * ch
  const spanA = skirtHemY - headTopY // 1129 model px
  const kA = ((1 - topMarginRatio) * ch) / spanA
  const cyA = headTopY + ((0.5 - topMarginRatio) * ch) / kA

  // Shot B: eyesY -> 0.30 * ch, 1.35x zoom vs Shot A (waist y=769 sits at ~90% height)
  const kB = kA * bOverARatio
  const cyB = eyesY + (0.2 * ch) / kB

  const sA = 1 / bOverARatio // ~0.74074
  const cameraW = cw / sA
  const cameraH = ch / sA
  const offsetLeft = (cw - cameraW) / 2
  const offsetTop = (ch - cameraH) / 2

  // View inside the oversized camera (cw/sA × ch/sA): produces exact pixel density kB while framing all of Shot A
  const minStage = Math.max(1, Math.min(cw, ch))
  const zoomA = (kA * ALIVING_MODEL_SIZE) / minStage
  const view: AlivingView = {
    zoom: zoomA,
    cx: centerX,
    cy: cyA,
  }

  return {
    cameraW,
    cameraH,
    offsetLeft,
    offsetTop,
    view,
    kA,
    kB,
    shotA: { tx: 0, ty: 0, scale: sA },
    shotB: { tx: 0, ty: (cyA - cyB) * kB, scale: 1 },
    shotExplode: { tx: cw * 0.06, ty: 0, scale: sA * 0.9 },
  }
}

function clampUnit(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return clamped === 0 ? 0 : clamped
}

/**
 * Computes Chaerin's face (eye-line center) in viewport coordinates by applying the active
 * camera transform (`shot`) to `modelPointToScreen(640, 238, ...)`.
 */
export function computeFaceScreenPosition(
  stageRect: { left: number; top: number; width: number; height: number },
  plan: AssembleCameraPlan,
  shot: CameraTransform,
): { x: number; y: number } {
  const inCam = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.eyesY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const localX = stageRect.width / 2 + shot.tx + (inCam.x - plan.cameraW / 2) * shot.scale
  const localY = stageRect.height / 2 + shot.ty + (inCam.y - plan.cameraH / 2) * shot.scale
  return {
    x: stageRect.left + localX,
    y: stageRect.top + localY,
  }
}

/**
 * Converts a viewport pointer coordinate relative to the face position into normalized
 * Aliving2D gaze coordinates `[-1, 1]`. Positive `x` looks right, positive `y` looks up.
 */
export function computePointerGaze(input: {
  pointerX: number
  pointerY: number
  faceX: number
  faceY: number
  stageWidth: number
  stageHeight: number
}): { x: number; y: number } {
  const denomX = Math.max(1, input.stageWidth) * 0.6
  const denomY = Math.max(1, input.stageHeight) * 0.6
  return {
    x: clampUnit((input.pointerX - input.faceX) / denomX),
    y: clampUnit(-(input.pointerY - input.faceY) / denomY),
  }
}
