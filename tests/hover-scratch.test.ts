import assert from 'node:assert/strict'
import test from 'node:test'
import { erasedFraction, farthestCorner } from '../src/shared/ui/hover-scratch/geometry.ts'

test('alpha coverage counts actual erased area including antialiased edges', () => {
  assert.equal(erasedFraction(new Uint8ClampedArray()), 0)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])), 0)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255])), 0.5)
  assert.equal(erasedFraction(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0])), 1)
  assert.ok(Math.abs(erasedFraction(new Uint8ClampedArray([0, 0, 0, 128])) - 127 / 255) < 1e-10)
})

test('the finishing radius covers every corner even from the edge or after a resize', () => {
  for (const [width, height] of [
    [1200, 400],
    [760, 380],
    [300, 600],
  ]) {
    for (const point of [
      { x: 0, y: 0 },
      { x: width! * 0.7, y: height! * 0.4 },
      { x: width!, y: height! },
    ]) {
      const radius = farthestCorner(point, width!, height!)
      for (const corner of [
        { x: 0, y: 0 },
        { x: width!, y: 0 },
        { x: 0, y: height! },
        { x: width!, y: height! },
      ]) {
        assert.ok(Math.hypot(corner.x - point.x, corner.y - point.y) <= radius + 1e-8)
      }
    }
  }
})
