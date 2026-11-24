import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHAERIN_JAR_THEME,
  MATE_FALLBACK_HUES,
  MATE_HUE_RANGE,
  capsuleBandTheme,
  capsuleJarTheme,
} from '../src/features/mates/capsule-jar/capsule-jar-theme.ts'

function hue(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  const r = ((value >> 16) & 255) / 255
  const g = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return null
  const d = max - min
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

test('채린 keeps the logo violet (my-mates colours unchanged)', () => {
  assert.deepEqual(capsuleJarTheme('chaerin'), CHAERIN_JAR_THEME)
  assert.deepEqual(CHAERIN_JAR_THEME, {
    lightHalf: '#EEE9FF',
    lightHalfShade: '#D9CEFB',
    tintHalf: '#C4B0FF',
    tintHalfShade: '#9878F6',
    glow: '#B9A3FB',
    rim: '#C4B9F3',
  })
  // The time-band tints of 채린 are the same as before the palette limit.
  const expected = {
    dawn: ['#A7AEF8', '#6D77F2', '#979FF7'],
    morning: ['#D0C9FB', '#9C8CF6', '#C2B9FA'],
    day: ['#DDD2FC', '#B19AF2', '#D1C4F9'],
    evening: ['#DBB6F9', '#BE79F5', '#D3A6F8'],
    night: ['#B18BF6', '#884EF2', '#A67BF5'],
  } as const
  for (const [band, [tint, shade, glow]] of Object.entries(expected)) {
    const theme = capsuleBandTheme(CHAERIN_JAR_THEME, band as keyof typeof expected)
    assert.deepEqual([theme.tintHalf, theme.tintHalfShade, theme.glow], [tint, shade, glow], band)
  }
})

test('every other mate stays between blue-violet and pink-violet — never gold, green or a rainbow', () => {
  const ids = ['upcoming-boy', 'mate-990777', 'mate-990002', 'mate-2', 'minjun', 'namhaksaeng', undefined]
  for (let index = 0; index < 400; index++) ids.push(`mate-${index * 7919}`)
  for (const id of ids) {
    const theme = capsuleJarTheme(id)
    for (const color of [theme.tintHalf, theme.tintHalfShade, theme.glow, theme.lightHalfShade]) {
      const h = hue(color)!
      assert.ok(h >= MATE_HUE_RANGE.min - 1 && h <= MATE_HUE_RANGE.max + 1, `${id} ${color} ${h}`)
    }
    for (const band of ['dawn', 'morning', 'day', 'evening', 'night'] as const) {
      const h = hue(capsuleBandTheme(theme, band).tintHalfShade)!
      assert.ok(h >= MATE_HUE_RANGE.min - 1 && h <= MATE_HUE_RANGE.max + 1, `${id} ${band} ${h}`)
    }
  }
  // Fallback hues keep clear of 채린's violet so 「전체」 tells mates apart.
  const chaerinHue = hue(CHAERIN_JAR_THEME.tintHalfShade)!
  for (const fallback of MATE_FALLBACK_HUES) assert.ok(Math.abs(fallback - chaerinHue) >= 20, String(fallback))
  // A mate keeps its colour (the same id, the same tones).
  assert.deepEqual(capsuleJarTheme('mate-990777'), capsuleJarTheme('mate-990777'))
})
