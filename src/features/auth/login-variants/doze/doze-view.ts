/**
 * Camera for the "졸던 채린 깨우기" stage (DEV-only login draft): Chaerin sits behind a laptop, so the framing goes a
 * little lower than the assemble bust shot (down to the desk) and the laptop lid hides the torso below the chest.
 * Same projection as the engine (`modelPointToScreen`), so the Live2D canvas, the still renders and the desk props
 * line up at every stage size.
 */
import {
  ALIVING_MODEL_SIZE,
  CHAERIN_V2_LANDMARKS,
  CHAERIN_V2_RENDERS,
  modelPointToScreen,
  type AlivingView,
  type ScreenBox,
} from '../../../mate-render/aliving-view.ts'

export const DOZE_FRAMING = {
  /** Stage height left above the head (room for the small "zZ"). */
  headMarginRatio: 0.08,
  /**
   * Front of the desk below the laptop: the bottom of the stage where the dialogue box, the hint and 「다시 보기」 sit,
   * so they lie on the desk instead of over the laptop. Share of the stage height, clamped in px.
   */
  deskFrontRatio: 0.15,
  deskFrontMin: 96,
  deskFrontMax: 150,
  /** Never zoom in so far that hair / shoulders are clipped on narrow stages. */
  minVisibleModelWidth: 640,
  /** Top edge of the laptop lid and of the desk, in model px. */
  lidTopModelY: 612,
  deskTopModelY: 714,
  /** Lid width in model px (centered on the model). */
  lidModelWidth: 400,
} as const

export interface DozeCamera {
  view: AlivingView
  /** CSS px per model px. */
  k: number
}

export function computeDozeCamera(cw: number, ch: number): DozeCamera {
  const { headTopY } = CHAERIN_V2_LANDMARKS
  const { headMarginRatio: m, deskFrontRatio, deskFrontMin, deskFrontMax, minVisibleModelWidth, deskTopModelY } =
    DOZE_FRAMING
  const deskFront = Math.min(deskFrontMax, Math.max(deskFrontMin, ch * deskFrontRatio))
  const kHeight = (ch - deskFront - m * ch) / (deskTopModelY - headTopY)
  const kWidth = cw / minVisibleModelWidth
  const k = Math.max(0.0001, Math.min(kHeight, kWidth))
  // The desk edge stays `deskFront` above the bottom; on narrow stages the extra room goes above the head.
  const cy = deskTopModelY - (ch / 2 - deskFront) / k
  const minStage = Math.max(1, Math.min(cw, ch))
  return { view: { zoom: (k * ALIVING_MODEL_SIZE) / minStage, cx: CHAERIN_V2_LANDMARKS.centerX, cy }, k }
}

/**
 * Where a still render (made with `render.view` on a canvas of `render.size`, see renders.json) lands on a (cw × ch)
 * stage drawn with `view`.
 */
export function computeStillBox(
  render: { size: { width: number; height: number }; view: AlivingView },
  cw: number,
  ch: number,
  view: AlivingView,
): ScreenBox {
  const kRender = (Math.min(render.size.width, render.size.height) / ALIVING_MODEL_SIZE) * render.view.zoom
  const modelLeft = render.view.cx - render.size.width / 2 / kRender
  const modelTop = render.view.cy - render.size.height / 2 / kRender
  const pt = modelPointToScreen(modelLeft, modelTop, cw, ch, view)
  return {
    left: pt.x,
    top: pt.y,
    width: (render.size.width / kRender) * pt.k,
    height: (render.size.height / kRender) * pt.k,
  }
}

/** The doze / yawn / happy stills are all rendered in the hero view (`expressions-bust/expressions.json`). */
export const DOZE_STILL_RENDER = CHAERIN_V2_RENDERS.hero

export interface DozeSceneLayout {
  still: ScreenBox
  /** Eye-line center (gaze origin, glow center). */
  face: { x: number; y: number }
  lid: ScreenBox
  deskTop: number
  /** Tap / click target over the head and upper body. */
  hit: ScreenBox
  /** Where the "zZ" rises from (beside the head). */
  zz: { x: number; y: number }
  k: number
}

export function computeDozeScene(cw: number, ch: number, camera: DozeCamera = computeDozeCamera(cw, ch)): DozeSceneLayout {
  const { view, k } = camera
  const at = (mx: number, my: number) => modelPointToScreen(mx, my, cw, ch, view)
  const { centerX, eyesY } = CHAERIN_V2_LANDMARKS
  const { lidTopModelY, deskTopModelY, lidModelWidth } = DOZE_FRAMING
  const face = at(centerX, eyesY)
  const lidTop = at(centerX - lidModelWidth / 2, lidTopModelY)
  const deskTop = at(centerX, deskTopModelY).y
  const hitTop = at(centerX - 230, 40)
  const hitBottom = at(centerX + 230, lidTopModelY)
  const zz = at(centerX + 210, 120)
  return {
    still: computeStillBox(DOZE_STILL_RENDER, cw, ch, view),
    face: { x: face.x, y: face.y },
    lid: { left: lidTop.x, top: lidTop.y, width: lidModelWidth * k, height: Math.max(0, deskTop - lidTop.y) },
    deskTop,
    hit: { left: hitTop.x, top: hitTop.y, width: hitBottom.x - hitTop.x, height: hitBottom.y - hitTop.y },
    zz: { x: zz.x, y: zz.y },
    k,
  }
}

/** True when the pointer is within `radius` px of the face (the "다가옴" wake trigger). */
export function isPointerNearFace(
  pointer: { x: number; y: number },
  face: { x: number; y: number },
  radius: number,
): boolean {
  return Math.hypot(pointer.x - face.x, pointer.y - face.y) <= radius
}
