import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange, periodDays } from '../src/features/reports/record-period.ts'
import { buildCapsuleCalendar } from '../src/features/records/capsule-calendar.ts'
import {
  GRID_LEVELS,
  gridLayout,
  gridLevel,
  gridNeighbor,
  gridTooltip,
  weekdayOfKey,
  yearWeekdayLabel,
} from '../src/features/records/contribution-grid.ts'

const DAY = 86_400_000
/** Every day of a calendar year, as keys. */
function yearKeys(year: number) {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  return Array.from({ length: (end - start) / DAY }, (_, index) => new Date(start + index * DAY).toISOString().slice(0, 10))
}
function record(startIso: string, minutes: number, id = startIso): StudyRecord {
  const startedAt = Date.parse(`${startIso}+09:00`)
  return {
    id, roomId: '1', characterIds: ['1'], tier: 'basic', startedAt, endedAt: startedAt + minutes * 60_000,
    studySeconds: minutes * 60, focusSeconds: 0, awaySeconds: 0, returns: 0, completed: false, automatic: false,
  }
}

test('shade: 0 without time, then 1–4 at 1 s, 30 min, 1 h and 2 h (absolute, the same in every period)', () => {
  assert.deepEqual(GRID_LEVELS.map((step) => step.minSeconds), [1, 1800, 3600, 7200])
  for (const [seconds, level] of [[0, 0], [-5, 0], [Number.NaN, 0], [1, 1], [29 * 60, 1], [30 * 60, 2], [59 * 60, 2], [3600, 3], [119 * 60, 3], [7200, 4], [9 * 3600, 4]] as const) {
    assert.equal(gridLevel(seconds), level, String(seconds))
  }
})

test('year: columns are weeks (Monday first), rows are weekdays; 2026 starts on a Thursday and has 53 columns', () => {
  const layout = gridLayout('year', yearKeys(2026))
  assert.equal(layout.rows, 7)
  assert.equal(layout.columns, 53)
  assert.deepEqual(layout.cells[0], { index: 0, key: '2026-01-01', col: 0, row: 3 })
  assert.deepEqual(layout.cells.at(-1), { index: 364, key: '2026-12-31', col: 52, row: 3 })
  // Every cell's row is its weekday; a week moves one column.
  for (const cell of layout.cells) assert.equal(cell.row, weekdayOfKey(cell.key))
  const monday = layout.cells.find((cell) => cell.key === '2026-01-05')!
  assert.deepEqual([monday.col, monday.row], [1, 0])
  // Month names where each month starts; 월 · 수 · 금 at the left.
  assert.deepEqual(layout.monthLabels.map((mark) => mark.label), ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'])
  assert.equal(layout.monthLabels[0]!.col, 0)
  assert.equal(layout.monthLabels[1]!.col, layout.cells.find((cell) => cell.key === '2026-02-01')!.col)
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(yearWeekdayLabel), ['월', '', '수', '', '금', '', ''])
})

test('year: a leap year keeps Feb 29; a leap year starting on Sunday needs 54 columns', () => {
  const leap = gridLayout('year', yearKeys(2028))
  assert.equal(leap.cells.length, 366)
  assert.ok(leap.cells.some((cell) => cell.key === '2028-02-29'))
  assert.equal(leap.columns, 53)
  assert.deepEqual(leap.cells.at(-1), { index: 365, key: '2028-12-31', col: 52, row: 6 })
  const longest = gridLayout('year', yearKeys(2040))
  assert.equal(longest.cells[0]!.row, 6, '2040-01-01 is a Sunday')
  assert.equal(longest.columns, 54)
  // The page's own year range gives the same days.
  assert.deepEqual(periodDays(getRecordRange('year', Date.parse('2028-06-01T12:00:00+09:00'))), yearKeys(2028))
})

test('month: a 7-column calendar (rows = weeks); week: one row of 7', () => {
  const month = gridLayout('month', periodDays(getRecordRange('month', Date.parse('2026-11-24T12:00:00+09:00'))))
  assert.equal(month.columns, 7)
  // November 2026 starts on a Sunday: 6 + 30 days → 6 rows.
  assert.deepEqual(month.cells[0], { index: 0, key: '2026-11-01', col: 6, row: 0 })
  assert.equal(month.rows, 6)
  assert.deepEqual(month.cells.at(-1), { index: 29, key: '2026-11-30', col: 0, row: 5 })
  const week = gridLayout('week', periodDays(getRecordRange('week', Date.parse('2026-11-24T12:00:00+09:00'))))
  assert.deepEqual([week.columns, week.rows], [7, 1])
  assert.deepEqual(week.cells.map((cell) => [cell.key, cell.col]), [
    ['2026-11-23', 0], ['2026-11-24', 1], ['2026-11-25', 2], ['2026-11-26', 3], ['2026-11-27', 4], ['2026-11-28', 5], ['2026-11-29', 6],
  ])
})

test('the day runs from 05:00 Seoul time: 04:30 on New Year’s Day is the last cell of the year before', () => {
  // The records page reads "today" 5 hours back too (RecordsPage `DAY_START_MS`).
  const now = Date.parse('2028-01-01T04:40:00+09:00') - 5 * 3600 * 1000
  const range = getRecordRange('year', now)
  assert.equal(range.startDay, '2027-01-01')
  assert.equal(range.today, '2027-12-31')
  const calendar = buildCapsuleCalendar([record('2028-01-01T04:30:00', 120, 'late'), record('2028-01-01T05:10:00', 60, 'next')], range)
  const layout = gridLayout('year', calendar.days.map((day) => day.key))
  const last = calendar.days.at(-1)!
  assert.equal(last.key, '2027-12-31')
  assert.equal(last.connectionSeconds, 7200, 'only the 04:30 connection')
  assert.equal(last.level, 4)
  assert.equal(last.isToday, true)
  assert.deepEqual(layout.cells.at(-1), { index: 364, key: '2027-12-31', col: 52, row: 4 })
})

test('arrow keys: year ↑↓ a day and ←→ a week, month ←→ a day and ↑↓ a week; never onto future days', () => {
  const days = Array.from({ length: 30 }, (_, i) => ({ isFuture: i > 20 }))
  assert.equal(gridNeighbor('year', 10, 'ArrowDown', days), 11)
  assert.equal(gridNeighbor('year', 10, 'ArrowRight', days), 17)
  assert.equal(gridNeighbor('year', 17, 'ArrowRight', days), 17, 'the next week is in the future')
  assert.equal(gridNeighbor('month', 10, 'ArrowUp', days), 3)
  assert.equal(gridNeighbor('month', 0, 'ArrowLeft', days), 0)
  assert.equal(gridNeighbor('week', 3, 'ArrowDown', days), null)
  assert.equal(gridNeighbor('week', 3, 'End', days), 20)
  assert.equal(gridNeighbor('week', 3, 'Enter', days), null)
})

test('tooltip: the date and the time together; with 「전체」 each mate’s time; future and empty days say so', () => {
  const base = { key: '2026-11-23', fullLabel: '11월 23일', isToday: false, isFuture: false }
  assert.deepEqual(gridTooltip({ ...base, connectionSeconds: 4800 }), ['11월 23일', '함께한 시간 1시간 20분'])
  assert.deepEqual(
    gridTooltip({ ...base, connectionSeconds: 4800, isToday: true }, [{ name: '채린', seconds: 3000 }, { name: '서도현', seconds: 1800 }, { name: '없음', seconds: 0 }]),
    ['11월 23일 (오늘)', '함께한 시간 1시간 20분', '채린 50분 · 서도현 30분'],
  )
  assert.deepEqual(gridTooltip({ ...base, connectionSeconds: 0 }), ['11월 23일', '기록 없음'])
  assert.deepEqual(gridTooltip({ ...base, connectionSeconds: 0, isFuture: true }), ['11월 23일', '아직 오지 않은 날'])
})
