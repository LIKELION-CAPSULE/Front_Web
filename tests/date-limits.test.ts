import assert from 'node:assert/strict'
import test from 'node:test'
import { clampCalendarDate, clampCalendarMonth, MIN_CALENDAR_DATE, MIN_CALENDAR_YEAR } from '../src/shared/lib/date-limits.ts'
import { getRecordRange, periodDays, recordsInRange } from '../src/features/reports/record-period.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

test('calendar dates start in 2026 while allowing past dates in supported years and later field minima', () => {
  assert.equal(MIN_CALENDAR_YEAR, 2026)
  assert.equal(clampCalendarDate('2025-12-31'), MIN_CALENDAR_DATE)
  assert.equal(clampCalendarDate('2026-02-01'), '2026-02-01')
  assert.equal(clampCalendarDate('2025-12-31', '2027-04-05'), '2027-04-05')
  assert.equal(clampCalendarDate('2026-01-01', '2025-01-01'), '2026-01-01')
  assert.equal(clampCalendarMonth('2025-12'), '2026-01')
  assert.equal(clampCalendarMonth('2026-02'), '2026-02')
})

test('week, month and year navigation cannot cross the 2026 floor, including a stale device clock', () => {
  for (const period of ['week', 'month', 'year'] as const) {
    const range = getRecordRange(period, Date.parse('2028-03-02T10:00:00+09:00'), -10000)
    assert.equal(range.startDay, '2026-01-01')
    assert.ok(periodDays(range).every(day => day >= '2026-01-01'))
    assert.equal(getRecordRange(period, Date.parse('2025-12-01T10:00:00+09:00')).startDay, '2026-01-01')
  }
})

test('the first partial week retains Thursday alignment and excludes pre-2026 records', () => {
  const now = Date.parse('2026-11-03T12:00:00+09:00')
  const range = getRecordRange('week', now, -10000)
  assert.equal(range.startDay, '2026-01-01')
  assert.equal(range.endDay, '2026-01-04')
  const source = { id: 'source', startedAt: now, endedAt: now } as unknown as StudyRecord
  const records = [
    // A connection is filed by the day it started, a day running from 05:00 Seoul time (records/connection-day.ts).
    { ...source, id: 'before', startedAt: Date.parse('2025-12-31T23:59:59+09:00'), endedAt: Date.parse('2026-01-01T00:30:00+09:00') },
    { ...source, id: 'night of 12-31', startedAt: Date.parse('2026-01-01T04:59:00+09:00'), endedAt: Date.parse('2026-01-01T05:30:00+09:00') },
    { ...source, id: 'boundary', startedAt: Date.parse('2026-01-01T05:00:00+09:00'), endedAt: Date.parse('2026-01-01T05:30:00+09:00') },
  ]
  assert.deepEqual(recordsInRange(records, range).map(record => record.id), ['boundary'])
})
