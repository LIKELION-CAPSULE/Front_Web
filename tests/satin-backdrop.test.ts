import assert from 'node:assert/strict'
import test from 'node:test'
import { contrast, glassOver, hexToRgb, revealAt, SATIN, type Rgb } from '../src/features/records/satin-backdrop/satin-config.ts'

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

test('entering 내 기록 the ribbons rise out of the canvas after the content, eased out; a later visit is shorter', () => {
  const { first, again, drift, narrow } = SATIN.reveal
  // The content needs no wait; the ribbons start a beat later and settle in about 2–3 s.
  assert.ok(first.delay > 0.2 && first.delay < 0.8)
  assert.ok(first.delay + first.duration >= 2 && first.delay + first.duration <= 3.5)
  assert.ok(again.delay + again.duration < first.delay + first.duration)
  // Nothing before the delay (the bare canvas), all of it at the end, never past it.
  assert.equal(revealAt(0, first), 0)
  assert.equal(revealAt(first.delay, first), 0)
  assert.equal(revealAt(first.delay + first.duration, first), 1)
  assert.equal(revealAt(60, first), 1)
  // Ease-out: most of the light comes early, the last part settles slowly.
  const half = revealAt(first.delay + first.duration / 2, first)
  assert.ok(half > 0.8 && half < 1, String(half))
  let previous = -1
  for (let t = 0; t <= 4; t += 0.05) {
    const value = revealAt(t, first)
    assert.ok(value >= previous - 1e-9)
    previous = value
  }
  // The bands only drift and widen a little (no sweeping entrance).
  assert.ok(drift > 0 && drift <= 0.15)
  assert.ok(narrow > 0 && narrow <= 0.3)
})
