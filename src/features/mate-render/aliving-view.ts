/**
 * Shared Aliving2D view projection & bust camera framing math for the v2 mates (1280×1280 model canvas). Written for
 * chaerin-v2; 서도현 (`seojin` bundle) stands in the same place on the canvas (head top ≈ y 31, eyes ≈ 17 px higher),
 * so his stills are rendered with the same views (`CHAERIN_V2_RENDERS`) and every framing below fits both.
 * Used by AlivingRenderer (`setView`), the mate previews and the login stage (doze/doze-view.ts), so the WebGL canvas
 * and the still images overlap pixel-for-pixel at every viewport size.
 */

export const ALIVING_MODEL_SIZE = 1280

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

function clampUnit(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return clamped === 0 ? 0 : clamped
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
  if (!Object.values(input).every(Number.isFinite) || input.stageWidth <= 0 || input.stageHeight <= 0) return { x: 0, y: 0 }
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
