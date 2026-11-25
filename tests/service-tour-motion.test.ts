import test from 'node:test'
import assert from 'node:assert/strict'
import { BEND_MAX_PX, BEND_RATIO, MOVE_MAX_MS, MOVE_MIN_MS, PASS_SPEED, bowSide, moveDuration, planPath, reachProgress, type Point } from '../src/features/tour/tour-motion.ts'
import { SpotSpring } from '../src/features/tour/tour-spotlight.ts'

// The service tour's motion (user decision 2026-11-26: 「좀 더 움직임이 자연스러우면 좋겠다」): tour-motion.ts.

const VIEWPORT = { width: 1440, height: 900 }
const CENTER = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 }
const FRAME = 1000 / 60
const distanceOf = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
/** Farthest distance of the path from the straight line between its ends, and the side it lies on. */
function bow(from: Point, to: Point, at: (t: number) => Point) {
  const length = distanceOf(from, to)
  const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length }
  let most = 0
  for (let t = 0; t <= 1; t += 0.01) {
    const p = at(t)
    const off = (p.x - from.x) * normal.x + (p.y - from.y) * normal.y
    if (Math.abs(off) > Math.abs(most)) most = off
  }
  return { most, normal }
}

test('a move takes 300–800 ms, longer the farther it goes', () => {
  assert.equal(moveDuration(0), MOVE_MIN_MS)
  assert.equal(moveDuration(5000), MOVE_MAX_MS)
  let last = 0
  for (const distance of [10, 60, 150, 300, 600, 900, 1200]) {
    const ms = moveDuration(distance)
    assert.ok(ms >= MOVE_MIN_MS && ms <= MOVE_MAX_MS, `${distance}px → ${ms}`)
    assert.ok(ms >= last, `${distance}px is not shorter than a nearer move`)
    last = ms
  }
  assert.ok(moveDuration(600) > moveDuration(100) + 150, 'a long move is clearly longer')
})

test('the speed profile starts and ends at rest (minimum jerk), or at the given passing speed', () => {
  assert.equal(reachProgress(0), 0)
  assert.equal(reachProgress(1), 1)
  assert.equal(reachProgress(0.5), 0.5)
  const speed = (t: number, v0 = 0, v1 = 0) => (reachProgress(t + 1e-4, v0, v1) - reachProgress(t - 1e-4, v0, v1)) / 2e-4
  assert.ok(speed(0.0001) < 0.01 && speed(0.9999) < 0.01, 'from rest to rest')
  assert.ok(speed(0.5) > 1.8, 'fastest in the middle (1.875× the average)')
  // Speeding up at first, slowing down at the end.
  assert.ok(reachProgress(0.2) < 0.1 && reachProgress(0.8) > 0.9)
  assert.ok(Math.abs(speed(0.9999, 0, PASS_SPEED) - PASS_SPEED) < 0.01, 'leaves at the passing speed')
  assert.ok(Math.abs(speed(0.0001, 0.7, 0) - 0.7) < 0.01, 'starts at the speed it comes in with')
  for (let t = 0; t <= 1; t += 0.02) assert.ok(speed(Math.min(0.9999, Math.max(0.0001, t)), 0.7, PASS_SPEED) >= 0, 'never goes back')
})

test('the path bows toward the middle of the screen, by a share of the distance', () => {
  const cases: [Point, Point][] = [
    [{ x: 100, y: 100 }, { x: 700, y: 120 }],
    [{ x: 1300, y: 800 }, { x: 300, y: 820 }],
    [{ x: 200, y: 850 }, { x: 260, y: 120 }],
    [{ x: 720, y: 666 }, { x: 378, y: 548 }],
  ]
  for (const [from, to] of cases) {
    const plan = planPath(from, to, { center: CENTER })
    assert.deepEqual(plan.at(0), from)
    const end = plan.at(1)
    assert.ok(distanceOf(end, to) < 1e-6, 'lands on the target')
    const { most, normal } = bow(from, to, plan.at)
    const distance = distanceOf(from, to)
    const expected = Math.min(BEND_MAX_PX, distance * BEND_RATIO)
    assert.ok(Math.abs(Math.abs(most) - expected) < 2, `bows ${Math.abs(most).toFixed(1)}px, expected ${expected}`)
    const middle = { x: (from.x + to.x) / 2 + normal.x * most, y: (from.y + to.y) / 2 + normal.y * most }
    const center = CENTER
    assert.ok(distanceOf(middle, center) < distanceOf({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, center), 'the bow is on the middle’s side')
    assert.equal(plan.duration, moveDuration(distance))
  }
  // Short moves bow a little, long ones more (in proportion), never more than BEND_MAX_PX.
  const short = bow({ x: 600, y: 300 }, { x: 680, y: 300 }, planPath({ x: 600, y: 300 }, { x: 680, y: 300 }, { center: CENTER }).at)
  assert.ok(Math.abs(short.most) < 12)
  // The side is decided, never random: the same move always bows the same way.
  assert.equal(bowSide({ x: 0, y: 0 }, { x: 100, y: 0 }, CENTER), bowSide({ x: 0, y: 0 }, { x: 100, y: 0 }, CENTER))
})

test('flowing through a mark: the next move leaves with the same velocity (no stop, no kink); a sharp turn stops', () => {
  const a = { x: 300, y: 300 }, b = { x: 700, y: 360 }, c = { x: 1000, y: 520 }
  const first = planPath(a, b, { center: CENTER, then: c })
  assert.ok(Math.hypot(first.exit.x, first.exit.y) > 0, 'passes through b')
  const second = planPath(b, c, { center: CENTER, enter: first.exit })
  const velocity = (plan: typeof first, t: number) => {
    const h = 1e-4
    const p = plan.at(Math.min(1, t + h)), q = plan.at(Math.max(0, t - h))
    const dt = (Math.min(1, t + h) - Math.max(0, t - h)) * plan.duration
    return { x: (p.x - q.x) / dt, y: (p.y - q.y) / dt }
  }
  const out = velocity(first, 1), into = velocity(second, 0)
  assert.ok(Math.hypot(out.x - first.exit.x, out.y - first.exit.y) < 0.01, 'exit is the real end velocity')
  assert.ok(Math.hypot(out.x - into.x, out.y - into.y) < 0.02, `same velocity across the mark: ${JSON.stringify(out)} vs ${JSON.stringify(into)}`)
  // Doubling back stops on the mark.
  const back = planPath(a, b, { center: CENTER, then: { x: 320, y: 310 } })
  assert.deepEqual(back.exit, { x: 0, y: 0 })
  // No next mark: stops.
  assert.deepEqual(planPath(a, b, { center: CENTER }).exit, { x: 0, y: 0 })
})

test('the light’s spring chases the arrow: a few px behind when it lands, on it soon after, never past it', () => {
  for (const distance of [120, 500, 1000]) {
    const from = { x: 100, y: 100 }, to = { x: 100 + distance, y: 100 }
    const plan = planPath(from, to, { center: CENTER })
    const spring = new SpotSpring({ left: from.x, top: from.y, width: 200, height: 80 })
    spring.tune(plan.duration)
    let gapAtLanding = Infinity, settledAfter = -1, past = 0
    for (let t = FRAME; t < plan.duration + 1500; t += FRAME) {
      const left = from.x + (to.x - from.x) * plan.progress(Math.min(1, t / plan.duration))
      const rest = spring.step({ left, top: from.y, width: 200, height: 80 }, FRAME)
      const now = spring.now
      past = Math.max(past, now.left - to.x)
      if (Math.abs(t - plan.duration) < FRAME / 2) gapAtLanding = to.x - now.left
      if (t >= plan.duration && settledAfter < 0 && rest) settledAfter = t - plan.duration
    }
    assert.ok(gapAtLanding >= 0 && gapAtLanding < 6, `${distance}px: ${gapAtLanding.toFixed(1)}px behind when the arrow lands`)
    assert.ok(settledAfter >= 0 && settledAfter <= 120, `${distance}px: at rest ${settledAfter.toFixed(0)} ms after the arrow`)
    assert.ok(past < 0.5, `${distance}px: overshoots ${past.toFixed(2)}px`)
  }
})
