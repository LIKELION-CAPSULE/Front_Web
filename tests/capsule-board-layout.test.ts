import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import {
  BOARD,
  boardCell,
  boardRiseTiming,
  buildCapsuleBoard,
  capsulesPerConnection,
  dayCapsuleCount,
  stackDay,
} from '../src/features/records/capsule-board/capsule-board-layout.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00') // Tuesday
const at = (iso: string) => Date.parse(`${iso}+09:00`)
function record(startIso: string, minutes: number, id = startIso): StudyRecord {
  const startedAt = at(startIso)
  return {
    id,
    roomId: '1',
    characterIds: ['1'],
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

test("a day's capsules are shared by time in start order (largest remainder, one each at least)", () => {
  assert.deepEqual(capsulesPerConnection([]), [])
  assert.deepEqual(capsulesPerConnection([60 * 60]), [2])
  // 50 + 70 min = 2 h → 4 capsules: 2 + 2
  assert.deepEqual(capsulesPerConnection([50 * 60, 70 * 60]), [2, 2])
  // 10 + 110 min → 4: the short one keeps one
  assert.deepEqual(capsulesPerConnection([10 * 60, 110 * 60]), [1, 3])
  for (const list of [[5, 5, 5], [30, 90, 200], [400, 10]]) {
    const counts = capsulesPerConnection(list.map((minutes) => minutes * 60))
    const total = list.reduce((sum, minutes) => sum + minutes, 0)
    assert.equal(counts.reduce((sum, value) => sum + value, 0), dayCapsuleCount(total * 60, list.length))
    assert.ok(counts.every((value) => value >= 1))
  }
})

test('a column stacks bottom → top by start, coloured by each connection band, the keepsake one larger', () => {
  const evening = record('2026-11-23T19:00:00', 60, 'evening')
  const dawn = record('2026-11-23T00:40:00', 30, 'dawn')
  const { capsules, height, compressed } = stackDay([evening, dawn], new Map([['evening', { connectionId: 'evening', hours: 1, piece: 5 }]]))
  assert.deepEqual(capsules.map((capsule) => capsule.band), ['dawn', 'evening', 'evening'])
  assert.deepEqual(capsules.map((capsule) => capsule.keepsake), [0, 0, 1])
  assert.ok(capsules[2]!.length > capsules[1]!.length)
  for (let index = 1; index < capsules.length; index++) assert.ok(capsules[index]!.y > capsules[index - 1]!.y)
  assert.equal(compressed, false)
  assert.ok(Math.abs(height - capsules.reduce((sum, capsule) => sum + capsule.length, 0)) < 1e-9)
})

test('columns above the cap keep every capsule but fit in the cap height', () => {
  const long = record('2026-11-23T09:00:00', 9 * 60)
  const { capsules, height, compressed } = stackDay([long])
  assert.equal(capsules.length, 18)
  assert.equal(compressed, true)
  assert.ok(Math.abs(height - BOARD.maxLevels * BOARD.capsuleLength) < 1e-9)
  // Heights compare: a 2 h day is half a 4 h day.
  const two = stackDay([record('2026-11-23T09:00:00', 120)]).height
  const four = stackDay([record('2026-11-23T09:00:00', 240)]).height
  assert.ok(Math.abs(four - two * 2) < 1e-9)
})

test('tiles: a row for the week, a weekday grid for the month, week columns for the year', () => {
  assert.deepEqual(boardCell('week', 3, 0), { x: 3, z: 0 })
  assert.deepEqual(boardCell('month', 0, 6), { x: 6, z: 0 })
  assert.deepEqual(boardCell('month', 1, 6), { x: 0, z: 1 })
  assert.deepEqual(boardCell('year', 10, 3), { x: 1, z: 6 })
  const records = [record('2026-11-23T20:00:00', 50), record('2026-11-24T08:00:00', 130)]
  const week = buildCapsuleBoard(records, getRecordRange('week', NOW))
  assert.equal(week.tiles.length, 7)
  assert.equal(week.cols, 7)
  assert.equal(week.rows, 1)
  assert.deepEqual(week.tiles.map((tile) => tile.capsules.length), [2, 4, 0, 0, 0, 0, 0])
  assert.equal(week.labels[1]!.today, true)
  const month = buildCapsuleBoard(records, getRecordRange('month', NOW))
  assert.equal(month.cols, 7)
  assert.equal(month.tiles.length, 30)
  const year = buildCapsuleBoard(records, getRecordRange('year', NOW))
  assert.equal(year.rows, 7)
  assert.equal(year.tiles.length, 365)
  assert.ok(year.capsuleLength > week.capsuleLength)
  assert.ok(year.labels.every((label) => label.kind === 'month'))
})

test('the rise plays only days with records, in date order, within 1–1.5 s', () => {
  const tiles = [{ capsules: [1, 2] }, { capsules: [] }, { capsules: [1, 2, 3, 4, 5, 6, 7, 8] }, { capsules: [1] }] as never
  const timing = boardRiseTiming(tiles)
  assert.deepEqual(timing.starts.map((start) => start === null), [false, true, false, false])
  assert.ok(timing.starts[0]! < timing.starts[2]! && timing.starts[2]! < timing.starts[3]!)
  assert.ok(timing.totalMs <= 1500)
  const many = Array.from({ length: 300 }, () => ({ capsules: [1, 2, 3] })) as never
  const full = boardRiseTiming(many)
  assert.ok(full.totalMs >= 1000 && full.totalMs <= 1500, String(full.totalMs))
  assert.equal(boardRiseTiming([{ capsules: [] }] as never).totalMs, 0)
})
