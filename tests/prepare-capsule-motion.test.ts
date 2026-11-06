import assert from 'node:assert/strict'
import test from 'node:test'
import { capsuleLanding, dotFlight, DOT_BURST_MS, DOT_CLEAR_MS, seededRandom, type DotRoute } from '../src/features/session/prepare-capsule-motion.ts'

test('random routes are repeatable for one scene and vary between scenes', () => {
  const first = seededRandom(23), repeat = seededRandom(23), other = seededRandom(24)
  const values = Array.from({ length: 100 }, () => first())
  assert.deepEqual(values, Array.from({ length: 100 }, () => repeat()))
  assert.notDeepEqual(values, Array.from({ length: 100 }, () => other()))
  assert.ok(values.every(value => value >= 0 && value < 1))
})

test('a horizontal capsule accelerates under gravity and moves sideways with wind', () => {
  const positions = [280, 520, 760].map(ms => capsuleLanding(ms, 1440, 1000, 240, 23))
  assert.ok(positions[1]!.y - positions[2]!.y > positions[0]!.y - positions[1]!.y)
  assert.notEqual(positions[0]!.x, positions[2]!.x)
  assert.ok(positions.every(position => Math.abs(position.angle + Math.PI / 2) < .3))
})

test('floor contact rebounds, damps and keeps the capsule above the floor in portrait and landscape', () => {
  for (const [width, height, scale] of [[390, 844, 168], [1440, 1000, 280]]) {
    const touch = capsuleLanding(808, width!, height!, scale!, 37)
    const rebound = capsuleLanding(940, width!, height!, scale!, 37)
    assert.ok(rebound.altitude > touch.altitude)
    for (let ms = 0; ms < 1500; ms += 7) {
      const pose = capsuleLanding(ms, width!, height!, scale!, 37)
      assert.ok(pose.y >= height! * .08)
      assert.ok(Object.values(pose).every(Number.isFinite))
    }
    const settled = capsuleLanding(1288, width!, height!, scale!, 37)
    assert.deepEqual(settled, capsuleLanding(2000, width!, height!, scale!, 37))
    assert.equal(settled.altitude, 0)
    assert.equal(settled.angle, -Math.PI / 2)
  }
})

const route: DotRoute = {
  origin: { x: 1.8, y: -.7, z: .2 }, scatter: { x: 1.1, y: .4, z: .4 },
  delay: 53, scatterMs: 450, flightMs: 950,
}
const target = { x: .05, y: -.16, z: .04 }, approach = { x: .04, y: .02, z: .01 }

test('scatter, homing and aperture entry join without position or velocity jumps', () => {
  const firstJoin = DOT_BURST_MS + route.delay + route.scatterMs, step = .05
  for (const join of [firstJoin, firstJoin + route.flightMs * .65]) {
    const before = dotFlight(route, join - step, target, approach)
    const at = dotFlight(route, join, target, approach)
    const after = dotFlight(route, join + step, target, approach)
    for (const axis of ['x', 'y', 'z'] as const) {
      if (join === firstJoin) assert.equal(at[axis], route.scatter[axis])
      assert.ok(Math.abs((at[axis] - before[axis]) / step - (after[axis] - at[axis]) / step) < .00001)
    }
  }
})

test('all staggered circles reach the capsule and disappear before the lid closes', () => {
  const random = seededRandom(3)
  for (let index = 0; index < 300; index++) {
    const staggered = { ...route, delay: random() * 140, scatterMs: 360 + random() * 140, flightMs: 850 + random() * 200 }
    assert.deepEqual(dotFlight(staggered, DOT_CLEAR_MS, target, approach), { ...target, size: 0 })
    for (let ms = DOT_BURST_MS; ms < DOT_CLEAR_MS; ms += 77) {
      const point = dotFlight(staggered, ms, target, approach)
      assert.ok(Object.values(point).every(Number.isFinite))
      assert.ok(point.size >= 0 && point.size <= 1)
    }
  }
})
