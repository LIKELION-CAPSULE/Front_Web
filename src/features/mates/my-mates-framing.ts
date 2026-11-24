import { CHAERIN_V2_RENDERS, computeStillMatchedView, type AlivingView } from '../mate-render/aliving-view.ts'

/**
 * Framing of the big mate in the my-mates panel: head to waist (the hero still, model y 31…769, and the expression
 * stills rendered in the same view), fitted to the panel's *height* and centred — the head stays near the top and the
 * waist at the bottom; in a narrow panel the still's empty side margins run past the edges. The still is drawn that
 * way by CSS (`.my-mates-live .mate-detail-fallback-img`); this is the Live2D camera that matches it pixel for pixel.
 */
export function waistBox(width: number, height: number) {
  const { width: imageWidth, height: imageHeight } = CHAERIN_V2_RENDERS.hero.size
  const boxWidth = (imageWidth / imageHeight) * height
  return { left: (width - boxWidth) / 2, top: 0, width: boxWidth, height }
}

export function waistFraming(width: number, height: number): AlivingView {
  return computeStillMatchedView(width, height, CHAERIN_V2_RENDERS.hero, waistBox(width, height))
}
