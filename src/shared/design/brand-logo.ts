/**
 * Official CAPSULE logo v2 (2026-11-22). The single place the app imports logo files from.
 * Source of truth: `design/brand/capsule-logo-2026-11-22-v2/` (README there has the usage rules).
 * The SVGs only carry a viewBox; the consumer sets the displayed size. Never recolour them.
 */
import horizontalColor from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-horizontal-color.svg'
import horizontalWhite from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-horizontal-white.svg'
import wordmarkColor from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-wordmark-color.svg'
import wordmarkWhite from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-wordmark-white.svg'
import symbolColor from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-symbol-color.svg'
import symbolWhite from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-symbol-white.svg'
import glyphColor from '../../../design/brand/capsule-logo-2026-11-22-v2/capsule-glyph-color.svg'

export const capsuleLogo = {
  /** Symbol + wordmark lockup. viewBox 1992×456. */
  horizontal: { color: horizontalColor, white: horizontalWhite },
  /** Wordmark only. */
  wordmark: { color: wordmarkColor, white: wordmarkWhite },
  /** App-icon symbol on its rounded tile. viewBox 472×456. */
  symbol: { color: symbolColor, white: symbolWhite },
  /** Capsule without the tile (decoration only; use `symbol` to identify the service). */
  glyph: { color: glyphColor },
} as const

/** Horizontal lockup geometry (viewBox units), for sizing and for splitting the symbol from the wordmark. */
export const CAPSULE_HORIZONTAL_VIEWBOX = { width: 1992, height: 456 } as const
/**
 * Fraction of the lockup width where the wordmark area may start: the symbol tile ends at x=472 and the wordmark
 * begins at x=528 (56 gap), so a cut at x=500 separates them cleanly.
 */
export const CAPSULE_HORIZONTAL_WORDMARK_START = 500 / CAPSULE_HORIZONTAL_VIEWBOX.width
