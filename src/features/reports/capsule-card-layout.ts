import { designColors, designPalette, designTypography } from '../../shared/design/tokens.ts'

/** CSS-pixel coordinates are shared by the 360×600 preview and 2× PNG. */
export const capsuleCardLayout = {
  width: 360, height: 600, padding: 28, contentWidth: 304,
  portrait: { top: 80, height: 234 },
  roomTitle: { inset: 12, width: 152 * 2 / 3 },
  intro: { top: 330 }, study: { top: 360 }, focus: { top: 412 },
  badge: { top: 448 },
  /** The badge ends at 474; the quote box runs from 482 to the bottom padding (572). Short quotes keep the original top (500); long ones grow upward and step the font down to fit. */
  quote: {
    top: 482, preferredTop: 500, maxHeight: 90, fontWeight: designTypography['story-quote'].fontWeight,
    fontSizes: [designTypography['story-quote'].fontSizePx, 22, 20, 18, 16, 14],
    lineHeightRatio: designTypography['story-quote'].lineHeightPx / designTypography['story-quote'].fontSizePx,
  },
} as const

export const capsuleCardColors = [designColors['primary-soft'], designColors.canvas]
export function isLightCapsule(color: string) {
  return color === designPalette.violet['50'] || color === designPalette.violet['300']
}
