import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRecordRange,
  periodDays,
  recordsInRange,
  recordSummary,
} from '../src/features/reports/record-period.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { dayKey } from '../src/shared/lib/format.ts'

const record = (endedAt: number, patch: Partial<StudyRecord> = {}): StudyRecord => ({
  id: String(endedAt),
  roomId: 'dawn-library',
  characterIds: ['chaerin'],
  tier: 'standard',
  startedAt: endedAt - 60000,
  endedAt,
  studySeconds: 60,
  focusSeconds: 60,
  awaySeconds: 0,
  returns: 0,
  completed: true,
  automatic: false,
  ...patch,
})

test('weeks use Monday and Seoul calendar dates across the UTC and year boundary', () => {
  const range = getRecordRange('week', Date.parse('2026-01-04T15:01:00Z'))
  assert.equal(range.today, '2026-01-05')
  assert.equal(range.startDay, '2026-01-05')
  assert.equal(range.endDay, '2026-01-11')
  const crossing = getRecordRange('week', Date.parse('2026-01-01T08:00:00+09:00'))
  assert.equal(crossing.startDay, '2025-12-29')
  assert.equal(crossing.endDay, '2026-01-04')
  assert.equal(periodDays(crossing).length, 7)
})

test('month and year ranges include leap days and exclude the next local midnight', () => {
  const now = Date.parse('2024-02-12T00:05:00+09:00')
  const month = getRecordRange('month', now)
  assert.equal(periodDays(month).length, 29)
  assert.equal(month.endDay, '2024-02-29')
  assert.equal(dayKey(month.end), '2024-03-01')
  const year = getRecordRange('year', now)
  assert.equal(periodDays(year).length, 366)
  assert.equal(year.startDay, '2024-01-01')
  assert.equal(year.endDay, '2024-12-31')
})

test('week navigation shifts full Seoul weeks and keeps the real today', () => {
  const now = Date.parse('2026-01-01T08:00:00+09:00')
  const previous = getRecordRange('week', now, -1)
  assert.equal(previous.startDay, '2025-12-22')
  assert.equal(previous.endDay, '2025-12-28')
  assert.equal(previous.today, '2026-01-01')
  assert.equal(previous.label, '지난 주')
  const next = getRecordRange('week', now, 1)
  assert.equal(next.startDay, '2026-01-05')
  assert.equal(next.endDay, '2026-01-11')
  assert.equal(periodDays(next).length, 7)
})

test('month navigation handles short months and crosses year boundaries without day overflow', () => {
  const now = Date.parse('2024-01-31T23:30:00+09:00')
  const next = getRecordRange('month', now, 1)
  assert.equal(next.startDay, '2024-02-01')
  assert.equal(next.endDay, '2024-02-29')
  assert.equal(next.dateLabel, '2024년 2월')
  assert.equal(next.today, '2024-01-31')
  const previous = getRecordRange('month', now, -1)
  assert.equal(previous.startDay, '2023-12-01')
  assert.equal(previous.endDay, '2023-12-31')
  assert.equal(previous.dateLabel, '2023년 12월')
  assert.equal(getRecordRange('month', now, 13).startDay, '2025-02-01')
})

test('record filtering includes start, excludes end and orders recent sessions first', () => {
  const range = getRecordRange('month', Date.parse('2026-10-27T10:00:00+09:00'))
  const source = [
    record(range.start - 1),
    record(range.start),
    record(range.end),
    record(range.end - 1),
  ]
  const found = recordsInRange(source, range)
  assert.deepEqual(
    found.map((item) => item.endedAt),
    [range.end - 1, range.start],
  )
  assert.equal(source[0]!.endedAt, range.start - 1)
})

test('period summaries weight focus by time and count companions once', () => {
  const summary = recordSummary([
    record(1, { studySeconds: 60, focusSeconds: 60, characterIds: ['chaerin', 'sua'] }),
    record(2, { studySeconds: 180, focusSeconds: 0, characterIds: ['sua', 'dahee'] }),
  ])
  assert.deepEqual(summary, { seconds: 240, focusRate: 25, sessions: 2, companions: 3 })
  assert.deepEqual(recordSummary([]), { seconds: 0, focusRate: 0, sessions: 0, companions: 0 })
})
