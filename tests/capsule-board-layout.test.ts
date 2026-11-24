import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import {
  BOARD,
  boardCell,
  boardRiseTiming,
  buildCapsuleBoard,
  capsuleColors,
  capsulesPerConnection,
  dayCapsuleCount,
  isMonthSelectable,
  offsetContaining,
  stackDay,
  yearSlot,
} from '../src/features/records/capsule-board/capsule-board-layout.ts'
import {
  boardStageAspect,
  boardTransition,
  chipSlots,
  boardViewSlot,
  defaultBoardView,
  isBoardView,
  parseStoredBoardViews,
  requestView,
  settleViewRequest,
  yearMonthNeighbor,
  type ViewRequestState,
  yearColumnsFor,
} from '../src/features/records/capsule-board/capsule-board-view.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00') // Tuesday
const at = (iso: string) => Date.parse(`${iso}+09:00`)
function record(startIso: string, minutes: number, id = startIso, characterId = '1'): StudyRecord {
  const startedAt = at(startIso)
  return {
    id,
    roomId: '1',
    characterIds: [characterId],
    tier: 'basic',
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    studySeconds: minutes * 60,
    focusSeconds: 0,
    awaySeconds: 0,
    returns: 0,
    completed: false,
    automatic: false,
  }
}

test('one capsule per 30 minutes of the day, at least one per connection', () => {
  assert.equal(dayCapsuleCount(0, 0), 0)
  assert.equal(dayCapsuleCount(5 * 60, 1), 1)
  assert.equal(dayCapsuleCount(44 * 60, 1), 1)
  assert.equal(dayCapsuleCount(45 * 60, 1), 2)
  assert.equal(dayCapsuleCount(120 * 60, 1), 4)
  assert.equal(dayCapsuleCount(20 * 60, 3), 3)
})

test("a day's capsules are shared by time (largest remainder, one each at least)", () => {
  assert.deepEqual(capsulesPerConnection([]), [])
  assert.deepEqual(capsulesPerConnection([60 * 60]), [2])
  assert.deepEqual(capsulesPerConnection([50 * 60, 70 * 60]), [2, 2])
  assert.deepEqual(capsulesPerConnection([10 * 60, 110 * 60]), [1, 3])
  for (const list of [[5, 5, 5], [30, 90, 200], [400, 10]]) {
    const counts = capsulesPerConnection(list.map((minutes) => minutes * 60))
    const total = list.reduce((sum, minutes) => sum + minutes, 0)
    assert.equal(counts.reduce((sum, value) => sum + value, 0), dayCapsuleCount(total * 60, list.length))
    assert.ok(counts.every((value) => value >= 1))
  }
})

test('a column stands on its tile and its capsules touch (no gaps), the keepsake one larger', () => {
  const evening = record('2026-11-23T19:00:00', 60, 'evening')
  const dawn = record('2026-11-23T00:40:00', 30, 'dawn')
  const { capsules, height } = stackDay([evening, dawn], {
    keepsakes: new Map([['evening', { connectionId: 'evening', hours: 1, piece: 5 }]]),
  })
  assert.deepEqual(capsules.map((capsule) => capsule.band), ['dawn', 'evening', 'evening'])
  assert.deepEqual(capsules.map((capsule) => capsule.keepsake), [0, 0, 1])
  assert.ok(capsules[2]!.length > capsules[1]!.length)
  // The lowest one's tip rests on (a little into) the tile.
  assert.ok(capsules[0]!.y - capsules[0]!.length / 2 <= 0)
  assert.ok(capsules[0]!.y - capsules[0]!.length / 2 > -capsules[0]!.length * 0.1)
  // Neighbours overlap a little (each rests in the tip below), never float apart.
  for (let index = 1; index < capsules.length; index++) {
    const below = capsules[index - 1]!
    const above = capsules[index]!
    const gap = above.y - above.length / 2 - (below.y + below.length / 2)
    assert.ok(gap < 0 && gap > -Math.min(below.length, above.length) * 0.3, `gap ${gap}`)
  }
  assert.ok(Math.abs(height - (capsules[2]!.y + capsules[2]!.length / 2)) < 1e-9)
})

test('columns above the cap keep every capsule but fit in the cap height; heights compare', () => {
  const { capsules, compressed } = stackDay([record('2026-11-23T09:00:00', 9 * 60)])
  assert.equal(capsules.length, 18)
  assert.equal(compressed, true)
  const capped = stackDay([record('2026-11-23T09:00:00', 4 * 60)])
  assert.equal(capped.compressed, false)
  assert.ok(Math.abs(stackDay([record('2026-11-23T09:00:00', 9 * 60)]).height - capped.height) < 1e-9)
  const one = stackDay([record('2026-11-23T09:00:00', 60)]).height
  const two = stackDay([record('2026-11-23T09:00:00', 120)]).height
  assert.ok(two > one * 1.6 && two < one * 2.2)
})

test('「전체」 stacks mate by mate in mate colours; one mate takes its time-band tints', () => {
  const chaerinEvening = record('2026-11-23T19:00:00', 30, 'a', '1')
  const boyMorning = record('2026-11-23T08:00:00', 30, 'b', '2')
  const mateOf = (item: StudyRecord) => (item.characterIds[0] === '1' ? 'chaerin' : 'mate-2')
  const all = stackDay([chaerinEvening, boyMorning], { mateOf, mateOrder: ['chaerin', 'mate-2'], colorMode: 'mate' })
  assert.deepEqual(all.capsules.map((capsule) => capsule.mateId), ['chaerin', 'mate-2'])
  assert.notEqual(all.capsules[0]!.colors.tint, all.capsules[1]!.colors.tint)
  assert.deepEqual(capsuleColors('chaerin', 'evening', 'mate'), capsuleColors('chaerin', 'dawn', 'mate'))
  assert.notDeepEqual(capsuleColors('chaerin', 'evening', 'band'), capsuleColors('chaerin', 'dawn', 'band'))
  const one = stackDay([chaerinEvening, boyMorning], { mateOf, colorMode: 'band' })
  assert.deepEqual(one.capsules.map((capsule) => capsule.recordId), ['b', 'a'])
  const board = buildCapsuleBoard([chaerinEvening, boyMorning], getRecordRange('week', NOW), {
    mateOf,
    mateOrder: ['chaerin', 'mate-2'],
    mateNames: new Map([['chaerin', '채린'], ['mate-2', '남학생']]),
    colorMode: 'mate',
  })
  assert.deepEqual(board.mates.map((mate) => mate.name), ['채린', '남학생'])
})

test('grids: a week row, a weekday month grid, and the year as twelve month boards with the same shape', () => {
  assert.deepEqual(boardCell('week', '2026-11-25', 2, 5), { x: -1, z: 0 })
  // November 2026 starts on Sunday (column 6).
  assert.deepEqual(boardCell('month', '2026-11-01', 0, 6), { x: 3, z: -2.5 })
  assert.deepEqual(boardCell('month', '2026-11-02', 1, 6), { x: -3, z: -1.5 })
  // In the year the same month board only moves (a fixed offset for every day of the month).
  const month = (key: string) => boardCell('month', key, 0, 6)
  const year = (key: string) => boardCell('year', key, 0, 6, 4)
  const offset = { x: year('2026-11-01').x - month('2026-11-01').x, z: year('2026-11-01').z - month('2026-11-01').z }
  for (const key of ['2026-11-09', '2026-11-30']) {
    assert.ok(Math.abs(year(key).x - month(key).x - offset.x) < 1e-9)
    assert.ok(Math.abs(year(key).z - month(key).z - offset.z) < 1e-9)
  }
  // 4 × 3 (wide) and 2 × 6 (narrow), centred.
  assert.ok(yearSlot(1, 4).x0 > yearSlot(0, 4).x0 && yearSlot(4, 4).z0 > yearSlot(0, 4).z0)
  assert.equal(yearSlot(2, 2).x0, yearSlot(0, 2).x0)
  const yearBoard = buildCapsuleBoard([record('2026-11-23T20:00:00', 50)], getRecordRange('year', NOW))
  assert.equal(yearBoard.tiles.length, 365)
  assert.equal(yearBoard.months.length, 12)
  assert.equal(yearBoard.months[10]!.activeDays, 1)
  assert.equal(yearBoard.labels.filter((label) => label.kind === 'month').length, 12)
  // Month labels sit in front of their boards (never under a column).
  for (const label of yearBoard.labels.filter((item) => item.kind === 'month')) {
    const board = yearBoard.months.find((item) => item.key === label.key)!
    assert.ok(label.z > board.z1)
  }
})

test('date labels sit at the front-right corner of their tile', () => {
  const week = buildCapsuleBoard([record('2026-11-23T20:00:00', 50)], getRecordRange('week', NOW))
  const label = week.labels.find((item) => item.kind === 'date' && item.key === '2026-11-23')!
  const tile = week.tiles.find((item) => item.day.key === '2026-11-23')!
  assert.ok(label.x > tile.x && label.z > tile.z)
  assert.equal(week.labels.find((item) => item.key === '2026-11-24')!.today, true)
})

test('the rise plays only days with records, in date order, within 1–1.5 s', () => {
  const tiles = [{ capsules: [1, 2] }, { capsules: [] }, { capsules: [1, 2, 3, 4, 5, 6, 7, 8] }, { capsules: [1] }] as never
  const timing = boardRiseTiming(tiles)
  assert.deepEqual(timing.starts.map((start) => start === null), [false, true, false, false])
  assert.ok(timing.totalMs <= 1500)
  const full = boardRiseTiming(Array.from({ length: 300 }, () => ({ capsules: [1, 2, 3] })) as never)
  assert.ok(full.totalMs >= 1000 && full.totalMs <= 1500, String(full.totalMs))
})

test('period offsets around the same day', () => {
  const today = '2026-11-25'
  assert.equal(offsetContaining('week', '2026-11-25', today), 0)
  assert.equal(offsetContaining('week', '2026-11-22', today), -1)
  assert.equal(offsetContaining('month', '2026-03-01', today), -8)
  assert.equal(offsetContaining('month', '2025-12-31', today), -11)
  assert.equal(offsetContaining('year', '2025-06-01', today), -1)
})

test('2D / 2.5D: week and month share the choice (default by width), the year keeps its own (default 2D)', () => {
  assert.equal(defaultBoardView(1440, null, 'week'), '25d')
  assert.equal(defaultBoardView(959, {}, 'month'), '2d')
  assert.equal(defaultBoardView(960, undefined, 'week'), '25d')
  assert.equal(defaultBoardView(1440, {}, 'year'), '2d')
  // A 2.5D choice for week/month does not turn the year into 2.5D; a year choice is kept for the year only.
  assert.equal(defaultBoardView(1440, { detail: '25d' }, 'year'), '2d')
  assert.equal(defaultBoardView(1440, { detail: '2d' }, 'month'), '2d')
  assert.equal(defaultBoardView(390, { detail: '25d', year: '25d' }, 'year'), '25d')
  assert.equal(defaultBoardView(1440, { year: '25d' }, 'week'), '25d')
  assert.equal(boardViewSlot('week'), 'detail')
  assert.equal(boardViewSlot('year'), 'year')
  // Stored values: v2 JSON, the v1 single value as the week/month choice, junk ignored.
  assert.deepEqual(parseStoredBoardViews('{"detail":"2d","year":"25d"}', null), { detail: '2d', year: '25d' })
  assert.deepEqual(parseStoredBoardViews(null, '2d'), { detail: '2d' })
  assert.deepEqual(parseStoredBoardViews('{"detail":"3d"}', null), {})
  assert.deepEqual(parseStoredBoardViews('not json', '25d'), { detail: '25d' })
  assert.equal(isBoardView('3d'), false)
  assert.equal(yearColumnsFor(400), 2)
  assert.equal(yearColumnsFor(1100), 4)
  assert.ok(boardStageAspect('year', '25d', true) < 1 && boardStageAspect('week', '25d', false) > 2)
  for (const count of [1, 2, 3, 8, 12, 18]) {
    const slots = chipSlots(Array.from({ length: count }, () => BOARD.capsuleLength))
    assert.equal(slots.length, count)
    for (const slot of slots) {
      assert.ok(slot.x - slot.length / 2 >= -0.43 && slot.x + slot.length / 2 <= 0.43, `x ${count}`)
      assert.ok(slot.z > -0.1 && slot.z < 0.43, `z ${count}`)
    }
  }
})

test('transitions: a new period around the same days morphs, a mate or another range rises', () => {
  const records = [record('2026-11-23T20:00:00', 50)]
  const week = buildCapsuleBoard(records, getRecordRange('week', NOW))
  const month = buildCapsuleBoard(records, getRecordRange('month', NOW))
  const lastWeek = buildCapsuleBoard(records, getRecordRange('week', NOW, -1))
  assert.equal(boardTransition(null, week), 'rise')
  assert.equal(boardTransition(week, month), 'morph')
  assert.equal(boardTransition(week, lastWeek), 'rise')
  assert.equal(boardTransition(week, buildCapsuleBoard(records, getRecordRange('week', NOW))), 'none')
  assert.equal(boardTransition(week, buildCapsuleBoard(records, getRecordRange('week', NOW), { colorMode: 'mate' })), 'rise')
})

test('capsules are shared by each connection’s share of the whole day (30 + 90 min → 1 + 3)', () => {
  assert.deepEqual(capsulesPerConnection([30 * 60, 90 * 60]), [1, 3])
  assert.deepEqual(capsulesPerConnection([90 * 60, 30 * 60]), [3, 1])
  assert.deepEqual(capsulesPerConnection([30 * 60, 30 * 60, 120 * 60]), [1, 1, 4])
  // The minimum of one comes from the largest count.
  assert.deepEqual(capsulesPerConnection([5 * 60, 5 * 60, 170 * 60]), [1, 1, 4])
  // Order does not change a connection's count (only its place); exact ties go to the earlier connection.
  for (const list of [[30, 90], [40, 50, 30], [10, 60, 140], [20, 25, 35, 100]]) {
    const forward = capsulesPerConnection(list.map((minutes) => minutes * 60))
    const backward = capsulesPerConnection([...list].reverse().map((minutes) => minutes * 60)).reverse()
    assert.deepEqual(forward, backward, list.join('+'))
  }
})

test('the 「전체」 column and the mate filter agree on each mate’s capsules', () => {
  const mateOf = (item: StudyRecord) => (item.characterIds[0] === '1' ? 'chaerin' : 'mate-2')
  const chaerin = record('2026-11-23T08:00:00', 30, 'c', '1')
  const boy = record('2026-11-23T20:00:00', 90, 'b', '2')
  const all = stackDay([chaerin, boy], { mateOf, mateOrder: ['chaerin', 'mate-2'], colorMode: 'mate' })
  const countOf = (capsules: readonly { mateId: string }[], mateId: string) => capsules.filter((capsule) => capsule.mateId === mateId).length
  assert.equal(countOf(all.capsules, 'chaerin'), stackDay([chaerin], { mateOf }).capsules.length)
  assert.equal(countOf(all.capsules, 'mate-2'), stackDay([boy], { mateOf }).capsules.length)
  // In general a mate's share in 「전체」 is within one capsule of its own column (rounding of the day total).
  for (const [a, b] of [[45, 45], [20, 100], [70, 50], [15, 15]]) {
    const one = record('2026-11-23T08:00:00', a!, 'x', '1')
    const two = record('2026-11-23T20:00:00', b!, 'y', '2')
    const both = stackDay([one, two], { mateOf, mateOrder: ['chaerin', 'mate-2'], colorMode: 'mate' }).capsules
    assert.ok(Math.abs(countOf(both, 'chaerin') - stackDay([one], { mateOf }).capsules.length) <= 1)
    assert.ok(Math.abs(countOf(both, 'mate-2') - stackDay([two], { mateOf }).capsules.length) <= 1)
  }
})

test('a view asked for during a period morph is never lost', () => {
  const start: ViewRequestState = { applied: '25d', requested: '25d' }
  // Month 2.5D → year 2D: the morph runs, the 2D request waits.
  let step = requestView(start, '2d', { morphing: true, animate: true })
  assert.equal(step.apply, null)
  // The morph is cut short (another year, another mate, a resize): 2D is applied at once.
  const cut = settleViewRequest(step.state, { interrupted: true })
  assert.deepEqual(cut.apply, { view: '2d', animate: false })
  assert.deepEqual(cut.state, { applied: '2d', requested: '2d' })
  // The morph plays out: 2D is applied with its own animation.
  assert.deepEqual(settleViewRequest(step.state, { interrupted: false }).apply, { view: '2d', animate: true })
  // Asked back before the morph ends: nothing to apply.
  step = requestView(step.state, '25d', { morphing: true, animate: true })
  assert.equal(settleViewRequest(step.state, { interrupted: true }).apply, null)
  // No morph: applied at once; the same view twice does nothing.
  assert.deepEqual(requestView(start, '2d', { morphing: false, animate: true }).apply, { view: '2d', animate: true })
  assert.equal(requestView(start, '25d', { morphing: false, animate: true }).apply, null)
  // Reduced motion never waits.
  assert.deepEqual(requestView(start, '2d', { morphing: true, animate: false }).apply, { view: '2d', animate: false })
})

test('the year keyboard and pointer only reach months that have begun', () => {
  const year = buildCapsuleBoard([record('2026-11-23T20:00:00', 50)], getRecordRange('year', NOW))
  const selectable = year.months.map((month) => isMonthSelectable(year, month.month))
  // NOW is in November: December has not begun.
  assert.deepEqual(selectable.map((value, index) => (value ? index : -1)).filter((index) => index >= 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const last = selectable.lastIndexOf(true)
  assert.equal(yearMonthNeighbor(10, 'ArrowRight', 4, last), 10)
  assert.equal(yearMonthNeighbor(9, 'ArrowRight', 4, last), 10)
  assert.equal(yearMonthNeighbor(7, 'ArrowDown', 4, last), 7)
  assert.equal(yearMonthNeighbor(6, 'ArrowDown', 4, last), 10)
  assert.equal(yearMonthNeighbor(3, 'End', 4, last), 10)
  assert.equal(yearMonthNeighbor(5, 'Home', 4, last), 0)
  assert.equal(yearMonthNeighbor(0, 'ArrowUp', 4, last), 0)
  assert.equal(yearMonthNeighbor(4, 'ArrowUp', 2, last), 2)
  assert.equal(yearMonthNeighbor(4, 'a', 4, last), null)
  // A past year: every month.
  const lastYear = buildCapsuleBoard([], getRecordRange('year', Date.parse('2027-03-10T12:00:00+09:00'), -1))
  assert.ok(lastYear.months.every((month) => isMonthSelectable(lastYear, month.month)))
})
