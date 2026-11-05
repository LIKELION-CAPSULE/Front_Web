import { designColors, designPalette, designTypography } from '../../shared/design/tokens.ts'

/** CSS-pixel coordinates are shared by the 360×600 preview and 2× PNG. */
export const capsuleCardLayout = {
  width: 360, height: 600, padding: 28, contentWidth: 304,
  portrait: { top: 80, height: 224 },
  intro: { top: 320 }, study: { top: 350 }, focus: { top: 402 },
  badge: { top: 438 },
  /** The badge ends at 464; the quote box runs from 480 to the bottom padding (572). Short quotes keep the original top (500); long ones grow upward and step the font down to fit. */
  quote: {
    top: 480, preferredTop: 500, maxHeight: 92, fontWeight: designTypography['story-quote'].fontWeight,
    fontSizes: [designTypography['story-quote'].fontSizePx, 22, 20, 18, 16, 14],
    lineHeightRatio: designTypography['story-quote'].lineHeightPx / designTypography['story-quote'].fontSizePx,
  },
} as const

export const capsuleCardColors = [designColors['primary-soft'], designColors.canvas, designPalette.violet['50'], designPalette.violet['300']]
export function isLightCapsule(color: string) {
  return color === designPalette.violet['50'] || color === designPalette.violet['300']
}
