import test from 'node:test'
import assert from 'node:assert/strict'
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three'
import { CAPSULE_ASPECT } from '../src/features/mates/capsule-jar/capsule-jar-layout.ts'
import {
  guideHours,
  guideLevel,
  guidesApply,
  instanceCapacity,
  longestDayKey,
  mixPillar,
  PILLAR_MIN_CAPSULE,
  PILLAR_TOP_CAPSULES,
  pillarDims,
  pillarFormAt,
  pillarHeight,
  pillarInstances,
  pillarLayout,
  pillarScaleHours,
  pillarsApply,
  planGuides,
} from '../src/features/records/capsule-board/capsule-board-pillars.ts'
import type { CapsuleColors } from '../src/features/records/capsule-board/capsule-board-layout.ts'
import { requestView, settleViewRequest, type ViewRequestState } from '../src/features/records/capsule-board/capsule-board-view.ts'

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

// ── A period change during a running morph (week → month → week in quick succession) ──

const sameCapsules = (a: readonly { y: number; length: number; tilt: number; yaw: number }[], b: typeof a, label: string) => {
  assert.equal(a.length, b.length, label)
  a.forEach((capsule, index) => {
    const other = b[index]!
    for (const key of ['y', 'length', 'tilt'] as const) assert.ok(Math.abs(capsule[key] - other[key]) < 1e-9, `${label} #${index} ${key}`)
    assert.ok(Math.abs(Math.atan2(Math.sin(capsule.yaw - other.yaw), Math.cos(capsule.yaw - other.yaw))) < 1e-9, `${label} #${index} yaw`)
  })
}

test('cut short: the next morph starts from the pillar on screen, not from the target of the morph it cut', () => {
  const week = pillarDims('week')
  const month = pillarDims('month')
  const list = capsules(5, violet, 2)
  const formOf = (period: 'week' | 'month', scaleHours: number) => {
    const dims = period === 'week' ? week : month
    return { layout: pillarLayout(list, 2.5 * 3600, { scaleHours, ...dims }), radius: dims.radius }
  }
  const W = formOf('week', 3)
  const M = formOf('month', 7)
  // week → month, cut at 40 % (eased) by → week: the frame before the cut and the first frame after it agree.
  const shownBefore = mixPillar(W, M, 0.4)
  const snapshot = pillarFormAt(W, M, 0.4)
  const firstAfter = mixPillar(snapshot, W, 0)
  assert.ok(Math.abs(firstAfter.height - shownBefore.height) < 1e-12)
  assert.ok(Math.abs(firstAfter.radius - shownBefore.radius) < 1e-12)
  sameCapsules(firstAfter.capsules, shownBefore.capsules, 'first frame after the cut')
  // …and it still lands exactly on the week's form.
  const landed = mixPillar(snapshot, W, 1)
  assert.equal(landed.height, W.layout.height)
  assert.equal(landed.radius, W.radius)
  sameCapsules(landed.capsules, W.layout.capsules, 'landed')
  // The old code started from the target (the month's form): a visible jump of the height.
  assert.ok(Math.abs(M.layout.height - shownBefore.height) > 0.1)

  // Rapid succession week → month → week → month → week, each cut part-way (the last plays out): the first frame
  // of every morph is the last frame of the one it cut.
  type Form = typeof W
  let running: { from: Form | null; to: Form; t: number } = { from: null, to: W, t: 1 } // settled on the week
  const steps: [Form, number][] = [[M, 0.3], [W, 0.65], [M, 0.1], [W, 1]]
  for (const [step, [next, cutAt]] of steps.entries()) {
    const shown = running.from
      ? mixPillar(running.from, running.to, running.t)
      : { height: running.to.layout.height, radius: running.to.radius, capsules: running.to.layout.capsules }
    const start = pillarFormAt(running.from, running.to, running.t)
    const first = mixPillar(start, next, 0)
    assert.ok(Math.abs(first.height - shown.height) < 1e-12, `step ${step} height`)
    assert.ok(Math.abs(first.radius - shown.radius) < 1e-12, `step ${step} radius`)
    sameCapsules(first.capsules, shown.capsules, `step ${step}`)
    // The fill's layers stay the target's (the scene scales them by the shown height).
    assert.equal(start.layout.segments, running.to.layout.segments)
    running = { from: start, to: next, t: cutAt }
  }
  sameCapsules(mixPillar(running.from!, running.to, 1).capsules, W.layout.capsules, 'played out')
  // Nothing to blend from, or a morph that played out: the target itself.
  assert.equal(pillarFormAt(null, W, 0.5), W)
  assert.equal(pillarFormAt(M, W, 1), W)
})

test('cut short: the week guide lines go on from the strength shown, on the board they belong to', () => {
  const weekA = { name: 'week A' }
  const monthB = { name: 'month B' }
  const monthC = { name: 'month C' }
  // Settled on the week: full lines. week → month: they fade out on the week's wall.
  const out = planGuides({ source: weekA, level: 1 }, { model: monthB, guides: false })
  assert.deepEqual(out, { source: weekA, fade: { from: 1, to: 0 } })
  const midOut = guideLevel(out.fade, 0.4)
  assert.ok(Math.abs(midOut - 0.6) < 1e-12)
  // Cut by → week: they come back from 0.6, not from 0 (the old code dropped them and faded in from nothing).
  const back = planGuides({ source: weekA, level: midOut }, { model: weekA, guides: true })
  assert.equal(back.source, weekA)
  assert.equal(guideLevel(back.fade, 0), midOut)
  assert.equal(guideLevel(back.fade, 1), 1)
  // Cut by → another month instead: the week's lines keep fading out from where they are.
  const away = planGuides({ source: weekA, level: midOut }, { model: monthC, guides: false })
  assert.equal(away.source, weekA)
  assert.equal(guideLevel(away.fade, 0), midOut)
  assert.equal(guideLevel(away.fade, 1), 0)
  // month → week cut part-way by → month: the half-shown lines fade out again.
  const into = planGuides({ source: null, level: 0 }, { model: weekA, guides: true })
  assert.deepEqual(into.fade, { from: 0, to: 1 })
  const half = guideLevel(into.fade, 0.5)
  const undo = planGuides({ source: weekA, level: half }, { model: monthB, guides: false })
  assert.equal(undo.source, weekA)
  assert.equal(guideLevel(undo.fade, 0), half)
  // No lines on screen and none ahead: nothing to draw.
  assert.deepEqual(planGuides({ source: null, level: 0 }, { model: monthB, guides: false }), { source: null, fade: { from: 0, to: 0 } })
  assert.deepEqual(planGuides({ source: weekA, level: 0 }, { model: monthB, guides: false }).source, null)
})

test('a 2D request during a morph waits through a second, cutting morph and is then played out', () => {
  let state: ViewRequestState = { applied: '2.5d', requested: '2.5d' }
  // week → month morph running; the viewer asks for 2D: it waits.
  let result = requestView(state, '2d', { morphing: true, animate: true })
  assert.equal(result.apply, null)
  state = result.state
  // → week again before it ends: the morph is replaced, not finished, so the request keeps waiting (the scene only
  // settles the view when a morph ends). When the second morph ends it is applied, animated.
  result = settleViewRequest(state, { interrupted: false })
  assert.deepEqual(result.apply, { view: '2d', animate: true })
  assert.equal(result.state.applied, '2d')
  // Asked back to 2.5D during the second morph instead: nothing left to apply.
  const undone = requestView(state, '2.5d', { morphing: true, animate: true }).state
  assert.equal(settleViewRequest(undone, { interrupted: false }).apply, null)
})

test('pillar instances grow and shrink with the days, and the buffers always fit them', () => {
  const week = pillarDims('week')
  const layoutOf = (count: number, colors = violet) =>
    count ? pillarLayout(capsules(count, colors), count * 1800, { scaleHours: 4, ...week }) : null
  const twoMates = (count: number) => {
    const list = [...capsules(count), ...capsules(count, blue)]
    return pillarLayout(list, list.length * 1800, { scaleHours: 8, ...week })
  }
  // week (7 days) → month (30 days, mates mixed) → week → nothing (a week without records) → month again.
  const boards: (ReturnType<typeof layoutOf>)[][] = [
    [layoutOf(2), null, layoutOf(4), layoutOf(1), null, null, layoutOf(3)],
    Array.from({ length: 30 }, (_, index) => (index % 3 === 0 ? null : index % 4 === 0 ? twoMates(2) : layoutOf(1 + (index % 5)))),
    [layoutOf(2), null, layoutOf(4), layoutOf(1), null, null, layoutOf(3)],
    Array.from({ length: 7 }, () => null),
    Array.from({ length: 31 }, (_, index) => twoMates(1 + (index % 3))),
  ]
  for (const board of boards) {
    const { entries, runs } = pillarInstances(board)
    assert.equal(entries.length, board.filter((pillar) => pillar && pillar.height > 0).length)
    for (const entry of entries) assert.ok(board[entry], 'an instance is a day with a pillar')
    assert.equal(runs.length, entries.reduce((sum, entry) => sum + board[entry]!.segments.length, 0))
    for (const run of runs) assert.ok(entries.includes(run.entry))
    for (const count of [entries.length, runs.length]) {
      const capacity = instanceCapacity(count)
      assert.ok(capacity >= count && capacity >= 1)
      // The meshes and their per-instance light (4 floats) are made for this capacity on every rebuild.
      const mesh = new InstancedMesh(new BufferGeometry(), new MeshBasicMaterial(), capacity)
      mesh.count = count
      const light = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
      for (let index = 0; index < count; index++) {
        mesh.setMatrixAt(index, new Matrix4().makeTranslation(index, 0, 0))
        light.setXYZW(index, 1, 1, 1, 1)
      }
      assert.equal(mesh.instanceMatrix.array.length, capacity * 16)
      assert.equal(light.count, capacity)
      if (count) assert.equal(mesh.instanceMatrix.array[(count - 1) * 16 + 12], count - 1, 'the last instance is written')
      mesh.dispose()
    }
  }
  // Two mates in one day: two fill layers for one tube.
  const mixed = pillarInstances([twoMates(2)])
  assert.equal(mixed.entries.length, 1)
  assert.equal(mixed.runs.length, 2)
})
