/**
 * Shared Aliving2D view projection & bust camera framing math for chaerin-v2 (1280×1280 model canvas).
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
  /** Mid-torso (halfway between neck y=385 and chest y=520): where the login light stream lands. */
  torsoY: 452,
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

export interface AssembleCameraPlan {
  /** Camera wrapper size == stage size (single bust shot, no oversized wrapper). */
  cameraW: number
  cameraH: number
  /** Offset of the wrapper inside the stage (always 0 for the bust shot). */
  offsetLeft: number
  offsetTop: number
  /** `setView(zoom, cx, cy)` passed to AlivingRenderer & used for layer placement inside `.assemble-camera`. */
  view: AlivingView
  /** Model-px-to-CSS-px scale. */
  k: number
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
 * Bust-shot framing used by the login wake-up sequence and its Live2D live state.
 * The source art has no legs and the waist must never show, so the stage bottom lands on the chest/solar plexus
 * (`bottomModelY`) with `headMarginRatio` of stage height above the head. On width-limited stages the chest stays on the
 * bottom edge and the head margin grows.
 */
export const BUST_FRAMING = {
  headMarginRatio: 0.07,
  /** Model-px y that sits on the stage's bottom edge (waist is 769; chest joint ~520). */
  bottomModelY: 640,
  /** Never zoom in so far that the shoulders/hair get clipped on narrow stages (model px kept visible horizontally). */
  minVisibleModelWidth: 560,
} as const

/**
 * Single-shot bust camera. Camera == stage and the Live2D view itself is zoomed, so the layers, the Live2D canvas and
 * the static image stay pixel-aligned at native density.
 */
export function computeBustCamera(cw: number, ch: number): AssembleCameraPlan {
  const { centerX, headTopY, eyesY } = CHAERIN_V2_LANDMARKS
  const { headMarginRatio: m, bottomModelY, minVisibleModelWidth } = BUST_FRAMING

  // Eyes fraction `e` such that headTop -> m*ch and bottomModelY -> ch share one scale k.
  const e = (eyesY - headTopY + m * (bottomModelY - eyesY)) / (bottomModelY - headTopY)
  const kHeight = ((e - m) * ch) / (eyesY - headTopY)
  const kWidth = cw / minVisibleModelWidth
  const k = Math.min(kHeight, kWidth)
  // Height-limited: eyes at `e*ch` gives exactly the head margin above and the chest on the bottom edge.
  // Width-limited (tall, narrow stage): the smaller `k` would reveal the torso below the chest, so bottom-align instead
  // (model `bottomModelY` on the stage bottom; the extra room goes above the head) — the waist never shows.
  const cy = k < kHeight ? bottomModelY - ch / (2 * k) : eyesY + ((0.5 - e) * ch) / k

  const minStage = Math.max(1, Math.min(cw, ch))
  return {
    cameraW: cw,
    cameraH: ch,
    offsetLeft: 0,
    offsetTop: 0,
    view: { zoom: (k * ALIVING_MODEL_SIZE) / minStage, cx: centerX, cy },
    k,
  }
}

function clampUnit(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return clamped === 0 ? 0 : clamped
}

/**
 * Computes Chaerin's face (eye-line center) in viewport coordinates from `modelPointToScreen(640, 238, ...)`
 * (the camera wrapper == the stage, so there is no extra camera transform).
 */
export function computeFaceScreenPosition(
  stageRect: { left: number; top: number; width: number; height: number },
  plan: AssembleCameraPlan,
): { x: number; y: number } {
  const inCam = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.eyesY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const localX = stageRect.width / 2 + (inCam.x - plan.cameraW / 2)
  const localY = stageRect.height / 2 + (inCam.y - plan.cameraH / 2)
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

/**
 * Engine views used to render the chaerin-v2 still images (`src/assets/characters/chaerin-v2/renders.json`).
 * `size` is the 1x display size of the image (the files are rendered at 2x); `view` is the `setView` value that
 * produced them. Kept in code so the Live2D camera can reproduce a still image's framing exactly
 * (`tests/mate-render.test.ts` checks these against renders.json).
 */
export const CHAERIN_V2_RENDERS = {
  hero: { size: { width: 760, height: 900 }, view: { zoom: 1.9718, cx: 640, cy: 384.6 } },
  card: { size: { width: 800, height: 600 }, view: { zoom: 2.5129, cx: 640, cy: 265.3 } },
  avatar: { size: { width: 512, height: 512 }, view: { zoom: 3.126, cx: 640, cy: 215.3 } },
  full: { size: { width: 900, height: 1200 }, view: { zoom: 1.3581, cx: 640, cy: 621.6 } },
} as const satisfies Record<string, { size: { width: number; height: number }; view: AlivingView }>

export type AlivingStillRender = (typeof CHAERIN_V2_RENDERS)[keyof typeof CHAERIN_V2_RENDERS]

/**
 * Box of an image drawn with `object-fit: contain` inside a (cw × ch) container.
 * `alignY` follows `object-position` (0 = top, 0.5 = center, 1 = bottom); x is always centered.
 */
export function computeContainedImageBox(
  cw: number,
  ch: number,
  imageWidth: number,
  imageHeight: number,
  alignY = 1,
): ScreenBox {
  const scale = Math.min(cw / Math.max(1, imageWidth), ch / Math.max(1, imageHeight))
  const width = imageWidth * scale
  const height = imageHeight * scale
  return { left: (cw - width) / 2, top: (ch - height) * alignY, width, height }
}

/**
 * Live2D view that draws the model exactly where a still render sits inside a (cw × ch) canvas, so the static image
 * and the live model overlap pixel-for-pixel during a crossfade.
 *
 * The still was produced with `render.view` on a canvas of `render.size`; drawn at `box`, one model px is
 * `kRender * box.width / render.size.width` CSS px and the image center is model `(render.view.cx, render.view.cy)`.
 */
export function computeStillMatchedView(
  cw: number,
  ch: number,
  render: { size: { width: number; height: number }; view: AlivingView },
  box: ScreenBox,
  modelSize = ALIVING_MODEL_SIZE,
): AlivingView {
  const { size, view } = render
  const kRender = (Math.min(size.width, size.height) / modelSize) * view.zoom
  const k = (kRender * box.width) / Math.max(1, size.width)
  const minStage = Math.max(1, Math.min(cw, ch))
  return {
    zoom: (k * modelSize) / minStage,
    cx: view.cx + (cw / 2 - (box.left + box.width / 2)) / k,
    cy: view.cy + (ch / 2 - (box.top + box.height / 2)) / k,
  }
}

/**
 * Preview camera for the mate preview stages (my mates, mate detail, connection record): the hero still is shown with
 * `object-fit: contain; object-position: center bottom`, and the Live2D view reproduces that framing at any stage size.
 */
export function computePreviewView(cw: number, ch: number): AlivingView {
  const render = CHAERIN_V2_RENDERS.hero
  const box = computeContainedImageBox(cw, ch, render.size.width, render.size.height, 1)
  return computeStillMatchedView(cw, ch, render, box)
}

/**
 * Call camera for the connection screen and its Picture-in-Picture window. Both show the card still (head → chest,
 * the video-call bust) with `object-fit: contain; object-position: center bottom` as their fallback, and the Live2D
 * view reproduces that framing, so the still shown in the main window while the model sits in PiP, the degraded
 * still and the live model all line up.
 */
export function computeCallView(cw: number, ch: number): AlivingView {
  const render = CHAERIN_V2_RENDERS.card
  const box = computeContainedImageBox(cw, ch, render.size.width, render.size.height, 1)
  return computeStillMatchedView(cw, ch, render, box)
}
