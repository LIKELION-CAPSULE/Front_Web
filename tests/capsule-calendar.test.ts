import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import {
  buildCapsuleCalendar,
  capsuleDaySummary,
  capsuleFillLevel,
  capsuleFillRatio,
  capsuleNeighbor,
  capsuleRevealOrder,
  capsuleRevealTiming,
  capsuleTooltip,
  defaultCapsuleDay,
  selectCapsuleDay,
} from '../src/features/records/capsule-calendar.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00') // Tuesday
const at = (iso: string) => Date.parse(`${iso}+09:00`)
function record(endIso: string, minutes: number, cameraMinutes?: number): StudyRecord {
  const endedAt = at(endIso)
  return {
    id: String(endedAt),
    roomId: '1',
    characterIds: ['1'],
    tier: 'basic',
    startedAt: endedAt - minutes * 60_000,
    endedAt,
    studySeconds: minutes * 60,
    focusSeconds: 0,
    awaySeconds: 0,
    returns: 0,
    completed: false,
    automatic: false,
    ...(cameraMinutes !== undefined
      ? { cameraFocus: { observedMs: minutes * 60_000, focusedMs: cameraMinutes * 60_000, returns: 0 } }
      : {}),
  }
}

test('fill level steps by absolute connection time: none, <30m, 30m+, 1h+, 2h+', () => {
  assert.equal(capsuleFillLevel(0), 0)
  assert.equal(capsuleFillLevel(-5), 0)
  assert.equal(capsuleFillLevel(Number.NaN), 0)
  assert.equal(capsuleFillLevel(60), 1)
  assert.equal(capsuleFillLevel(29 * 60), 1)
  assert.equal(capsuleFillLevel(30 * 60), 2)
  assert.equal(capsuleFillLevel(60 * 60), 3)
  assert.equal(capsuleFillLevel(119 * 60), 3)
  assert.equal(capsuleFillLevel(120 * 60), 4)
  assert.equal(capsuleFillLevel(9 * 3600), 4)
  const ratios = ([0, 1, 2, 3, 4] as const).map(capsuleFillRatio)
  assert.equal(ratios[0], 0)
  assert.equal(ratios[4], 1)
  for (let i = 1; i < ratios.length; i++) assert.ok(ratios[i]! > ratios[i - 1]!)
})

test('week, month and year produce one capsule per day with weekday alignment', () => {
  const records = [record('2026-11-23T20:00:00', 40), record('2026-11-23T22:00:00', 30), record('2026-11-24T08:00:00', 130)]
  const week = buildCapsuleCalendar(records, getRecordRange('week', NOW))
  assert.equal(week.days.length, 7)
  assert.equal(week.leadingBlanks, 0)
  assert.equal(week.days[0]!.label, '월 23')
  assert.equal(week.days[0]!.connectionSeconds, 70 * 60)
  assert.equal(week.days[0]!.sessions, 2)
  assert.equal(week.days[0]!.level, 3)
  assert.equal(week.days[1]!.level, 4)
  assert.equal(week.days[1]!.isToday, true)
  assert.equal(week.days[2]!.isFuture, true)

  const month = buildCapsuleCalendar(records, getRecordRange('month', NOW))
  assert.equal(month.days.length, 30)
  assert.equal(month.leadingBlanks, 6) // 2026-11-01 is a Sunday
  assert.equal(month.days[22]!.label, '23')

  const year = buildCapsuleCalendar(records, getRecordRange('year', NOW))
  assert.equal(year.days.length, 365)
  assert.equal(year.leadingBlanks, 3) // 2026-01-01 is a Thursday
  assert.equal(year.monthMarks.length, 12)
  assert.deepEqual(year.monthMarks[0], { label: '1월', column: 0 })
  assert.ok(year.monthMarks.every((mark, i) => i === 0 || mark.column > year.monthMarks[i - 1]!.column))
  assert.equal(year.days.filter((day) => day.level > 0).length, 2)
})

test('future records never fill a capsule', () => {
  const week = buildCapsuleCalendar([record('2026-11-26T20:00:00', 60)], getRecordRange('week', NOW))
  const thursday = week.days.find((day) => day.key === '2026-11-26')!
  assert.equal(thursday.isFuture, true)
  assert.equal(thursday.level, 0)
  assert.equal(thursday.sessions, 0)
})

test('the fill-in always lasts 0.8–1.2 seconds, however many days have records', () => {
  for (const filled of [1, 2, 3, 7, 12, 30, 120, 365]) {
    const timing = capsuleRevealTiming(filled)
    const end = timing.fillMs + timing.stepMs * (filled - 1)
    assert.ok(end >= 800 && end <= 1200, `${filled}: ${end}`)
    assert.equal(timing.totalMs, end)
    assert.ok(timing.fillMs >= 320, `${filled}: fill ${timing.fillMs}`)
    assert.ok(timing.stepMs >= 0 && timing.stepMs <= 110)
  }
  assert.equal(capsuleRevealTiming(1).stepMs, 0)
  assert.ok(capsuleRevealTiming(365).stepMs < capsuleRevealTiming(7).stepMs)
  assert.equal(capsuleRevealTiming(0).totalMs, 0)
})

test('only days with records reveal, in date order; empty and future days stay still', () => {
  const days = [
    { level: 0, isFuture: false },
    { level: 2, isFuture: false },
    { level: 0, isFuture: false },
    { level: 4, isFuture: false },
    { level: 1, isFuture: false },
    { level: 0, isFuture: true },
  ] as const
  assert.deepEqual(capsuleRevealOrder(days), [null, 0, null, 1, 2, null])

  // A year whose only records are in late November starts filling right away (order 0), not after January.
  const year = buildCapsuleCalendar(
    [record('2026-11-20T20:00:00', 50), record('2026-11-23T20:00:00', 70)],
    getRecordRange('year', NOW),
  )
  const order = capsuleRevealOrder(year.days)
  const filled = year.days.map((day, i) => [day.key, order[i]] as const).filter(([, o]) => o !== null)
  assert.deepEqual(filled, [['2026-11-20', 0], ['2026-11-23', 1]])
  // The first filled day starts at 0 ms and the second one step later, ending at 1 s.
  const timing = capsuleRevealTiming(filled.length)
  assert.equal(timing.stepMs, 110)
  assert.equal(timing.fillMs + timing.stepMs, 1000)
})

test('keyboard moves by day/week per layout and never lands on future days', () => {
  const days = Array.from({ length: 30 }, (_, i) => ({ isFuture: i > 23 }))
  assert.equal(capsuleNeighbor('month', 10, 'ArrowRight', days), 11)
  assert.equal(capsuleNeighbor('month', 10, 'ArrowDown', days), 17)
  assert.equal(capsuleNeighbor('month', 20, 'ArrowDown', days), 20) // would be future
  assert.equal(capsuleNeighbor('month', 3, 'ArrowUp', days), 3)
  assert.equal(capsuleNeighbor('month', 10, 'End', days), 23)
  assert.equal(capsuleNeighbor('month', 10, 'Home', days), 0)
  assert.equal(capsuleNeighbor('month', 10, 'a', days), null)
  assert.equal(capsuleNeighbor('year', 10, 'ArrowDown', days), 11)
  assert.equal(capsuleNeighbor('year', 10, 'ArrowRight', days), 17)
  assert.equal(capsuleNeighbor('week', 2, 'ArrowDown', days), null)
  assert.equal(capsuleNeighbor('week', 2, 'ArrowLeft', days), 1)
  assert.equal(capsuleNeighbor('week', 0, 'End', [{ isFuture: true }]), null)
})

test('tooltip and selected-day summary use 함께한 시간 and show camera time only when measured', () => {
  const records = [record('2026-11-23T20:00:00', 55, 44), record('2026-11-24T08:00:00', 50)]
  const week = buildCapsuleCalendar(records, getRecordRange('week', NOW))
  const [monday, today, wednesday] = week.days
  assert.equal(capsuleTooltip(monday!), '11월 23일 · 함께한 시간 55분 · 1회')
  assert.equal(capsuleTooltip(today!), '11월 24일 (오늘) · 함께한 시간 50분 · 1회')
  assert.equal(capsuleTooltip(wednesday!), '11월 25일 · 아직 오지 않은 날')
  assert.equal(capsuleDaySummary(monday!), '11월 23일 · 함께한 시간 55분 · 연결 1회 · 카메라로 함께한 시간 44분')
  assert.equal(capsuleDaySummary(today!), '11월 24일 · 오늘 · 함께한 시간 50분 · 연결 1회')
})

test("selected day hands over that day's records, newest first, and the default is today", () => {
  const records = [record('2026-11-23T08:00:00', 20), record('2026-11-23T21:00:00', 30), record('2026-11-24T08:00:00', 50)]
  const week = buildCapsuleCalendar(records, getRecordRange('week', NOW))
  const selection = selectCapsuleDay(records, week.days[0]!)
  assert.deepEqual(selection.records.map((r) => r.studySeconds), [1800, 1200])
  assert.equal(defaultCapsuleDay(week.days)?.key, '2026-11-24')
  const lastWeek = buildCapsuleCalendar(records, getRecordRange('week', NOW, -1))
  assert.equal(defaultCapsuleDay(lastWeek.days)?.key, lastWeek.days[0]!.key)
})
