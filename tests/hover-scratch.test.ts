import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coverageRadius,
  coverAlpha,
  erasedFraction,
  fractalNoise,
  MIN_SPREAD_RATE,
  restoreStrength,
  spreadRate,
} from '../src/shared/ui/hover-scratch/geometry.ts'

test('the ink mask stays covered outside the brush and clears at its core', () => {
  for (const noise of [0, 0.5, 1]) {
    assert.equal(coverAlpha(0, noise), 1)
    assert.equal(coverAlpha(1, noise), 0)
  }
  // Noise moves the edge: the same field level is revealed on one side and covered on the other.
  assert.ok(coverAlpha(0.32, 0.8) < 0.5)
  assert.ok(coverAlpha(0.32, 0.2) > 0.5)
})

test('restore recedes oldest strokes first and ends fully covered', () => {
  const duration = 1000
  assert.equal(restoreStrength(1, 0, 0, duration), 1)
  assert.equal(restoreStrength(1, 1, 0, duration), 1)
  assert.ok(restoreStrength(1, 0, 400, duration) < restoreStrength(1, 1, 400, duration))
  assert.equal(restoreStrength(1, 1, 400, duration), 1)
  for (const order of [0, 0.5, 1]) assert.equal(restoreStrength(0.6, order, duration, duration), 0)
})

test('edge noise is deterministic and bounded', () => {
  const a = fractalNoise(64, 32, 1200, 400, 56, 11)
  const b = fractalNoise(64, 32, 1200, 400, 56, 11)
  assert.deepEqual(a, b)
  assert.ok(a.every((value) => value >= 0 && value <= 1))
  assert.notDeepEqual(a, fractalNoise(64, 32, 1200, 400, 56, 29))
})

test('alpha coverage counts actual erased area including antialiased edges', () => {
  assert.equal(erasedFraction(new Uint8ClampedArray()), 0)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])), 0)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255])), 0.5)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0])), 1)
  assert.ok(Math.abs(erasedFraction(new Uint8ClampedArray([0, 0, 0, 128])) - 127 / 255) < 1e-10)
})

test('the bloom reach covers every spot of the frame from any set of seeds', () => {
  for (const [width, height] of [
    [1200, 400],
    [760, 380],
    [300, 600],
  ]) {
    for (const seeds of [
      [{ x: 0, y: 0 }],
      [
        { x: width! * 0.7, y: height! * 0.4 },
        { x: width! * 0.2, y: height! * 0.8 },
      ],
      [{ x: width!, y: height! }],
    ]) {
      const reach = coverageRadius(seeds, width!, height!)
      for (let y = 0; y <= height!; y += 7) {
        for (let x = 0; x <= width!; x += 7) {
          const nearest = Math.min(...seeds.map((seed) => Math.hypot(seed.x - x, seed.y - y)))
          assert.ok(nearest <= reach + 1e-8)
        }
      }
    }
  }
})

test('bloom rates are deterministic, uneven and never slower than the minimum', () => {
  const rates = Array.from({ length: 24 }, (_, i) => spreadRate(i))
  assert.deepEqual(rates, Array.from({ length: 24 }, (_, i) => spreadRate(i)))
  assert.ok(rates.every((rate) => rate >= MIN_SPREAD_RATE && rate <= 2 - MIN_SPREAD_RATE))
  assert.ok(Math.max(...rates) - Math.min(...rates) > 0.3)
})
