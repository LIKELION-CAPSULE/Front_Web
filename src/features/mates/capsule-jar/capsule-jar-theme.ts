import type { CapsuleJarTheme } from './capsule-jar-types.ts'
import type { TimeBand } from './capsule-moments.ts'

/**
 * 채린 follows the two tones of the logo v2 capsule (design/brand/capsule-logo-2026-11-22-v2/README.md: white → #D4C3FA
 * body, #B397FC → #8053F2 seam) as frosted and pale violet glass, glowing from a core inside.
 */
export const CHAERIN_JAR_THEME: CapsuleJarTheme = {
  lightHalf: '#EEE9FF',
  lightHalfShade: '#D9CEFB',
  tintHalf: '#C4B0FF',
  tintHalfShade: '#9878F6',
  glow: '#B9A3FB',
  rim: '#C4B9F3',
}

const MATE_JAR_THEMES: Readonly<Record<string, CapsuleJarTheme>> = {
  chaerin: CHAERIN_JAR_THEME,
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hsl(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

/**
 * Returns the mate's colours. Mates without a registered palette get a calm, low-saturation tint derived from
 * their id so every mate keeps its own colour without anyone hand-picking it first.
 */
export function capsuleJarTheme(mateId: string | undefined): CapsuleJarTheme {
  if (mateId && MATE_JAR_THEMES[mateId]) return MATE_JAR_THEMES[mateId]
  const hue = hashString(mateId ?? 'mate') % 360
  return {
    lightHalf: '#FFFFFF',
    lightHalfShade: hsl(hue, 70, 88),
    tintHalf: hsl(hue, 80, 78),
    tintHalfShade: hsl(hue, 70, 58),
    glow: hsl(hue, 75, 78),
    rim: hsl(hue, 60, 84),
  }
}

function hexToHsl(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return { hue: 0, saturation: 0, lightness: lightness * 100 }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return { hue: hue * 60, saturation: saturation * 100, lightness: lightness * 100 }
}

/**
 * Time-band shifts of the mate's colours (hue in degrees, saturation and lightness in points), all inside the violet
 * family for 채린: 새벽 bluer, 아침 and 낮 lighter lavender, 저녁 a little pink, 밤 deeper. Small on purpose: told
 * apart side by side, never a different colour. Saturation stays at most 86 (no gold, no rainbow, no glare).
 */
export const TIME_BAND_SHIFT: Readonly<Record<TimeBand, { hue: number; saturation: number; lightness: number }>> = {
  dawn: { hue: -20, saturation: -4, lightness: -3 },
  morning: { hue: -6, saturation: 0, lightness: 4 },
  day: { hue: 0, saturation: -10, lightness: 6 },
  evening: { hue: 18, saturation: 2, lightness: 0 },
  night: { hue: 6, saturation: 4, lightness: -9 },
}

function shift(hex: string, by: { hue: number; saturation: number; lightness: number }) {
  const { hue, saturation, lightness } = hexToHsl(hex)
  // Near-white glass keeps most of its whiteness: the shift scales with how coloured the tone already is.
  const amount = Math.min(1, saturation / 40 + (100 - lightness) / 25)
  return hsl(
    (hue + by.hue * amount + 360) % 360,
    Math.max(0, Math.min(86, saturation + by.saturation * amount)),
    Math.max(8, Math.min(97, lightness + by.lightness * amount)),
  )
}

/** The mate's colours moved for a time band (the same band always gives the same colours). */
export function capsuleBandTheme(theme: CapsuleJarTheme, band: TimeBand): CapsuleJarTheme {
  const by = TIME_BAND_SHIFT[band]
  return {
    lightHalf: shift(theme.lightHalf, by),
    lightHalfShade: shift(theme.lightHalfShade, by),
    tintHalf: shift(theme.tintHalf, by),
    tintHalfShade: shift(theme.tintHalfShade, by),
    glow: shift(theme.glow, by),
    rim: theme.rim,
  }
}
