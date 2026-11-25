import test from 'node:test'
import assert from 'node:assert/strict'
import { CAPSULE_ASPECT } from '../src/features/mates/capsule-jar/capsule-jar-layout.ts'
import {
  guideHours,
  guidesApply,
  longestDayKey,
  mixPillar,
  PILLAR_MIN_CAPSULE,
  PILLAR_TOP_CAPSULES,
  pillarDims,
  pillarHeight,
  pillarLayout,
  pillarScaleHours,
  pillarsApply,
} from '../src/features/records/capsule-board/capsule-board-pillars.ts'
import type { CapsuleColors } from '../src/features/records/capsule-board/capsule-board-layout.ts'

const day = (key: string, hours: number) => ({ day: { key, connectionSeconds: hours * 3600 } }) as never
const violet: CapsuleColors = { light: '#ffffff', tint: '#8053f2', glow: '#a080ff' }
const blue: CapsuleColors = { light: '#ffffff', tint: '#4060f0', glow: '#6080ff' }
const capsules = (count: number, colors = violet, keepsakeAt = -1) =>
  Array.from({ length: count }, (_, index) => ({ colors, keepsake: index === keepsakeAt ? 100 : 0, roll: index * 0.37 }))

test('pillars for the week and the month (the year keeps its columns); guide lines only in the week', () => {
  assert.ok(pillarsApply('week') && pillarsApply('month') && !pillarsApply('year'))
  assert.ok(guidesApply('week') && !guidesApply('month') && !guidesApply('year'))
  // The month's pillars are thinner and lower and its camera looks down more steeply (less hidden behind the front).
  const week = pillarDims('week')
  const month = pillarDims('month')
  assert.ok(month.radius < week.radius && month.maxHeight < week.maxHeight && month.elevation > week.elevation)
})

test('height rule: the longest day rounded up to whole hours (at least 2 h) is the full pillar', () => {
  assert.equal(pillarScaleHours([day('a', 0.5), day('b', 1.2)]), 2)
  assert.equal(pillarScaleHours([day('a', 2.5)]), 3)
  assert.equal(pillarScaleHours([day('a', 3)]), 3)
  assert.equal(pillarScaleHours([]), 2)
  const { maxHeight } = pillarDims('week')
  assert.equal(pillarHeight(3 * 3600, 3, maxHeight), maxHeight)
  assert.equal(pillarHeight(1.5 * 3600, 3, maxHeight), maxHeight / 2)
  // Proportional: twice the time, twice the height (a bar chart).
  assert.ok(Math.abs(pillarHeight(2 * 3600, 4, 2) - 2 * pillarHeight(3600, 4, 2)) < 1e-9)
  assert.equal(pillarHeight(10 * 3600, 3, maxHeight), maxHeight)
})

test('guide lines: two or three whole hours up to the scale', () => {
  assert.deepEqual(guideHours(2), [1, 2])
  assert.deepEqual(guideHours(3), [1, 2, 3])
  assert.deepEqual(guideHours(4), [2, 4])
  assert.deepEqual(guideHours(6), [2, 4, 6])
  assert.deepEqual(guideHours(9), [3, 6, 9])
  for (const hours of [2, 3, 4, 5, 6, 7, 8, 9, 12, 24]) {
    const list = guideHours(hours)
    assert.ok(list.length >= 2 && list.length <= 3, `${hours}: ${list}`)
  }
})

test('the longest day is marked (none without records)', () => {
  assert.equal(longestDayKey([day('a', 1), day('b', 2.5), day('c', 2)]), 'b')
  assert.equal(longestDayKey([day('a', 0)]), null)
})

test('capsules lie in the pillar, one per 30 minutes, filling its height in order', () => {
  const dims = pillarDims('week')
  const layout = pillarLayout(capsules(4), 2 * 3600, { scaleHours: 2, maxHeight: dims.maxHeight, radius: dims.radius })
  assert.equal(layout.height, dims.maxHeight)
  assert.equal(layout.capsules.length, 4)
  assert.ok(!layout.simplified)
  for (let index = 1; index < 4; index++) assert.ok(layout.capsules[index]!.y > layout.capsules[index - 1]!.y)
  // Lying across the pillar: never longer than the inside, leaning at most a little.
  for (const capsule of layout.capsules) {
    assert.ok(capsule.length <= dims.radius * 2 * 0.9 + 1e-9)
    assert.ok(Math.abs(capsule.tilt) <= (34 * Math.PI) / 180 + 1e-9)
    assert.ok(capsule.visible)
  }
  assert.ok(layout.capsules.at(-1)!.y < layout.height)
})

test('mates (or connections) fill the pillar layer by layer', () => {
  const list = [...capsules(3, violet), ...capsules(2, blue)]
  const layout = pillarLayout(list, 2.5 * 3600, { scaleHours: 3, maxHeight: 2, radius: 0.22 })
  assert.equal(layout.segments.length, 2)
  assert.equal(layout.segments[0]!.colors, violet)
  assert.equal(layout.segments[1]!.colors, blue)
  assert.equal(layout.segments[0]!.y0, 0)
  assert.ok(Math.abs(layout.segments[1]!.y1 - layout.height) < 1e-9)
  assert.ok(Math.abs(layout.segments[0]!.y1 - layout.segments[1]!.y0) < 1e-9)
})

test('too many capsules for the pillar: a fill of light with the top few and the keepsake drawn', () => {
  const dims = pillarDims('month')
  const layout = pillarLayout(capsules(24, violet, 5), 12 * 3600, { scaleHours: 12, maxHeight: dims.maxHeight, radius: dims.radius })
  assert.ok(layout.simplified)
  const shown = layout.capsules.filter((capsule) => capsule.visible)
  assert.equal(shown.length, PILLAR_TOP_CAPSULES + 1)
  assert.ok(layout.capsules[5]!.visible, 'the keepsake stays')
  for (const capsule of shown) {
    assert.ok(capsule.y <= layout.height)
    assert.ok(capsule.length * CAPSULE_ASPECT > 0)
  }
  // A readable capsule is never thinner than the threshold when drawn in full.
  const roomy = pillarLayout(capsules(3), 1.5 * 3600, { scaleHours: 2, maxHeight: 1.45, radius: 0.22 })
  assert.ok(!roomy.simplified && roomy.capsules[0]!.length >= PILLAR_MIN_CAPSULE)
})

test('an empty day has no pillar', () => {
  assert.deepEqual(pillarLayout([], 0, { scaleHours: 2, maxHeight: 2, radius: 0.2 }), { height: 0, capsules: [], segments: [], simplified: false })
})

test('period morph: a pillar and its capsules turn from the old period form into the new one', () => {
  const week = pillarDims('week')
  const month = pillarDims('month')
  const list = capsules(4)
  const from = { layout: pillarLayout(list, 2 * 3600, { scaleHours: 2, ...week }), radius: week.radius }
  const to = { layout: pillarLayout(list, 2 * 3600, { scaleHours: 5, ...month }), radius: month.radius }
  const start = mixPillar(from, to, 0)
  const end = mixPillar(from, to, 1)
  const half = mixPillar(from, to, 0.5)
  assert.equal(start.height, from.layout.height)
  assert.equal(end.height, to.layout.height)
  assert.ok(Math.abs(half.height - (from.layout.height + to.layout.height) / 2) < 1e-12)
  assert.ok(Math.abs(half.radius - (week.radius + month.radius) / 2) < 1e-12)
  end.capsules.forEach((capsule, index) => {
    assert.ok(Math.abs(capsule.y - to.layout.capsules[index]!.y) < 1e-12)
    assert.ok(Math.abs(capsule.length - to.layout.capsules[index]!.length) < 1e-12)
  })
  // Capsules move steadily between the two heights (no jump at the start).
  assert.ok(Math.abs(start.capsules[2]!.y - from.layout.capsules[2]!.y) < 1e-12)
  // A capsule hidden in one form (the filled pillar) grows in instead of popping.
  const filled = { layout: pillarLayout(capsules(24, violet, 5), 12 * 3600, { scaleHours: 12, ...month }), radius: month.radius }
  const roomy = { layout: pillarLayout(capsules(24, violet, 5), 12 * 3600, { scaleHours: 12, ...week }), radius: week.radius }
  const hiddenIndex = filled.layout.capsules.findIndex((capsule) => !capsule.visible)
  const mid = mixPillar(filled, roomy, 0.5).capsules[hiddenIndex]!
  assert.ok(mid.visible && mid.length > 0 && mid.length < roomy.layout.capsules[hiddenIndex]!.length)
  // Different counts (should not happen for one day): the new form as is.
  const other = { layout: pillarLayout(capsules(3), 1.5 * 3600, { scaleHours: 2, ...week }), radius: week.radius }
  assert.equal(mixPillar(other, to, 0.3).capsules, to.layout.capsules)
})
