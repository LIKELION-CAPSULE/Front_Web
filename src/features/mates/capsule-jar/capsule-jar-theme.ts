import type { CapsuleJarTheme } from './capsule-jar-types.ts'

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
