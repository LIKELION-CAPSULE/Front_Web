import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import {
  buildCapsuleCalendar,
  capsuleDaySummary,
  capsuleNeighbor,
  capsuleTooltip,
  capsuleBandLabel,
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
  assert.equal(capsuleTooltip(monday!), '11월 23일 · 함께한 시간 55분 · 1회 · 저녁')
  assert.equal(capsuleTooltip(today!), '11월 24일 (오늘) · 함께한 시간 50분 · 1회 · 아침')
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

test('a day takes the tint of the band where the most time was spent; ties keep the earlier connection', () => {
  const records = [
    // Monday: 새벽 20m (00:10–00:30), 저녁 60m (19:00–20:00), 밤 30m → 저녁, mixed
    record('2026-11-23T00:30:00', 20),
    record('2026-11-23T20:00:00', 60),
    record('2026-11-23T22:30:00', 30),
    // Tuesday: 아침 30m, 낮 30m → tie, the earlier (아침)
    record('2026-11-24T08:00:00', 30),
    record('2026-11-24T13:00:00', 30),
  ]
  const week = buildCapsuleCalendar(records, getRecordRange('week', NOW))
  const [monday, tuesday, wednesday] = week.days
  assert.equal(monday!.band, 'evening')
  assert.equal(monday!.mixedBands, true)
  assert.equal(capsuleBandLabel(monday!), '주로 저녁')
  assert.equal(tuesday!.band, 'morning')
  assert.equal(wednesday!.band, null)
  assert.equal(capsuleBandLabel(wednesday!), null)
})

test('keepsake days carry the highest milestone passed that day and say 「함께한 지 n시간」', () => {
  const first = record('2026-11-23T20:00:00', 70)
  const second = record('2026-11-24T08:00:00', 50)
  const keepsakes = new Map([[first.id, 1]])
  const week = buildCapsuleCalendar([first, second], getRecordRange('week', NOW), keepsakes)
  const [monday, today] = week.days
  assert.equal(monday!.keepsakeHours, 1)
  assert.equal(today!.keepsakeHours, null)
  assert.equal(capsuleTooltip(monday!), '11월 23일 · 함께한 시간 1시간 10분 · 1회 · 저녁 · 함께한 지 1시간')
  assert.equal(capsuleDaySummary(monday!), '11월 23일 · 함께한 시간 1시간 10분 · 연결 1회 · 함께한 지 1시간')
  const both = buildCapsuleCalendar([first, record('2026-11-23T22:00:00', 30)], getRecordRange('week', NOW), new Map([[first.id, 1], [String(at('2026-11-23T22:00:00')), 3]]))
  assert.equal(both.days[0]!.keepsakeHours, 3)
})
