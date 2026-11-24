/**
 * 「새틴 리본」 backdrop of 내 기록: every number in one place (colours, bands, speed, resolution, frame rate, light).
 * Adapted from Originkit "Satin Ribbon" (originkit.dev) — 상업 서비스 사용 허용, 재배포·판매 금지 (사용자 확인
 * 2026-11-25, docs/REFERENCE_COMMERCIAL_USE.md). Pure and renderer-free (unit-tested).
 *
 * Calm on purpose: dark ribbons of the brand violet on the page canvas, a wave every ~35 s, rendered small and
 * stretched, at most 30 frames a second, and kept away from the middle of the screen where the board is.
 */

export type Rgb = readonly [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export type SatinBand = {
  /** Centre line at x = 0 (screen units: −0.5 bottom … 0.5 top). */
  offset: number
  /** Slope of the centre line (diagonal, outward). */
  slope: number
  /** Half width (screen units). */
  width: number
  /** 0…1 position of the band's tone between the deep and the light violet. */
  tone: number
  /** Coverage (how much the band shows over the canvas). */
  opacity: number
  /** Phase offset (radians). */
  phase: number
}

export const SATIN = {
  /** Page canvas (docs/DESIGN_SYSTEM.md `canvas`). */
  background: '#0F0E17',
  /** Logo v2 capsule violets: the deep seam #8053F2 and the light body #D4C3FA. */
  deep: '#8053F2',
  light: '#D4C3FA',
  /** The ribbons' overall light (scales the violet: keeps the backdrop dark under the content). */
  gain: 0.24,
  /** White gloss, very faint. */
  specular: 0.08,
  sheen: 0.05,
  /** Lavender edge threads, barely there (no gold). */
  filament: 0.06,
  filamentColor: '#D9CEFB',
  /**
   * Three bands, pushed to the top and the bottom and laid on a diagonal, so the middle of the screen (the board)
   * gets the least ribbon.
   */
  bands: [
    { offset: 0.3, slope: 0.12, width: 0.13, tone: 0.55, opacity: 0.9, phase: 0 },
    { offset: 0.43, slope: -0.06, width: 0.08, tone: 0.85, opacity: 0.7, phase: 2.4 },
    { offset: -0.36, slope: 0.1, width: 0.12, tone: 0.3, opacity: 0.85, phase: 4.1 },
  ] satisfies readonly SatinBand[],
  /** How much the middle band of the screen (|y| < ~0.2) is dimmed (0 = not at all). */
  centreDim: 0.35,
  /** Main wave speed (radians per second): one swell every 2π / 0.18 ≈ 35 s. The second wave runs at −0.6×. */
  flow: 0.18,
  /** Wave heights (screen units) of the two travelling sine waves. */
  waveA: 0.06,
  waveB: 0.1,
  /** The light drifts toward the pointer very slowly (per second) and only a little (light direction units). */
  lightFollow: 0.5,
  lightRange: 0.18,
  /** Drawing buffer scale of the CSS size (device pixel ratio ignored): soft ribbons stretch without showing it. */
  resolutionScale: 0.4,
  /** Frame cap. */
  maxFps: 30,
  /** Reduced motion: the one still frame is drawn at this time (seconds). */
  stillTime: 12,
  /**
   * Entering 내 기록 the ribbons rise out of the canvas: their light (gain) eases from 0 to full while each band drifts
   * in from just beyond its edge of the screen and widens a little. The content is there first (it needs no wait) and
   * the board's columns rise in ~1.3 s; the ribbons follow a beat later and settle after them. The first visit of the
   * page load takes the long version; coming back to the tab later takes a shorter one (seen it already, still not a
   * hard cut). Reduced motion: none (the still frame at once).
   */
  reveal: {
    first: { delay: 0.45, duration: 2.6 },
    again: { delay: 0.15, duration: 1.4 },
    /** How far (screen units) each band starts beyond its resting place, outward (top bands up, the bottom one down). */
    drift: 0.12,
    /** How much narrower each band starts (fraction of its width). */
    narrow: 0.25,
  },
} as const

export type SatinReveal = { delay: number; duration: number }

/** Ease-out (cubic) progress of the entrance at `seconds` after the backdrop started: 0 before the delay, then to 1. */
export function revealAt(seconds: number, { delay, duration }: SatinReveal): number {
  if (duration <= 0) return 1
  const linear = Math.min(1, Math.max(0, (seconds - delay) / duration))
  return 1 - (1 - linear) ** 3
}

/** Relative luminance (WCAG). */
export function luminance([r, g, b]: Rgb) {
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Colour of the home-bubble glass over a backdrop colour (no blur): `panel` at 68 % (its lighter corner) or `canvas`
 * at 62 % (its darker corner) over what is behind, 140 % saturation of the backdrop ignored (it only moves hue).
 */
export function glassOver(backdrop: Rgb, corner: 'panel' | 'canvas'): Rgb {
  const glass = hexToRgb(corner === 'panel' ? '#191823' : '#0F0E17')
  const alpha = corner === 'panel' ? 0.68 : 0.62
  return glass.map((value, index) => value * alpha + backdrop[index]! * (1 - alpha)) as unknown as Rgb
}
