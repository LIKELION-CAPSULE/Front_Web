import assert from 'node:assert/strict'
import test from 'node:test'
import { contrast, glassOver, hexToRgb, SATIN, type Rgb } from '../src/features/records/satin-backdrop/satin-config.ts'

function hue([r, g, b]: Rgb) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

test('the satin backdrop stays calm: brand violets on the canvas, slow, small, capped', () => {
  assert.equal(SATIN.background, '#0F0E17')
  // Logo v2 violets only (no gold, no rainbow): every colour's hue is violet.
  for (const hex of [SATIN.deep, SATIN.light, SATIN.filamentColor]) {
    const h = hue(hexToRgb(hex))
    assert.ok(h >= 240 && h <= 280, `${hex} ${h}`)
  }
  assert.ok(SATIN.gain <= 0.3 && SATIN.specular <= 0.12 && SATIN.filament <= 0.1)
  // One swell takes tens of seconds.
  const period = (2 * Math.PI) / SATIN.flow
  assert.ok(period >= 20 && period <= 60, String(period))
  assert.ok(SATIN.maxFps <= 30 && SATIN.resolutionScale <= 0.5)
  assert.ok(SATIN.lightRange <= 0.25 && SATIN.lightFollow <= 1)
  // Bands keep to the top and the bottom (the board in the middle stays clear).
  for (const band of SATIN.bands) assert.ok(Math.abs(band.offset) >= 0.28, String(band.offset))
  assert.ok(SATIN.bands.length >= 2 && SATIN.bands.length <= 3)
})

test('text on the glass blocks keeps 4.5:1 when the brightest ribbon passes behind', () => {
  // The brightest ribbon pixel measured on the page over one full swell (1440×900, 2026-11-25): rgb(60, 55, 79).
  const peak: Rgb = [60 / 255, 55 / 255, 79 / 255]
  const subtle = hexToRgb('#A4A3B0')
  const muted = hexToRgb('#CAC9D4')
  for (const corner of ['panel', 'canvas'] as const) {
    const behind = glassOver(peak, corner)
    assert.ok(contrast(subtle, behind) >= 4.5, `subtle on ${corner}: ${contrast(subtle, behind)}`)
    assert.ok(contrast(muted, behind) >= 4.5, `muted on ${corner}`)
  }
  // Even without any glass, the ink stays readable over the ribbon.
  assert.ok(contrast(hexToRgb('#FAFAFD'), peak) >= 4.5)
})
