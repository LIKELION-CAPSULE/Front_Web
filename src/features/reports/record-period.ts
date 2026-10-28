import type { StudyRecord } from '../demo/types.ts'
import { dayKey } from '../../shared/lib/format.ts'

export const recordPeriods = [
  { id: 'week', label: '주' },
  { id: 'month', label: '월' },
  { id: 'year', label: '년' },
] as const
export type RecordPeriod = (typeof recordPeriods)[number]['id']
export type RecordRange = ReturnType<typeof getRecordRange>
const DAY = 86400000
const SEOUL_OFFSET = 9 * 3600000

export function getRecordRange(period: RecordPeriod, now = Date.now(), offset = 0) {
  const today = dayKey(now)
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const midnight = Date.UTC(year, month - 1, day) - SEOUL_OFFSET
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const start =
    period === 'week'
      ? midnight - ((weekday + 6) % 7) * DAY + offset * 7 * DAY
      : Date.UTC(year + (period === 'year' ? offset : 0), period === 'month' ? month - 1 + offset : 0, 1) - SEOUL_OFFSET
  const end =
    period === 'week'
      ? start + 7 * DAY
      : Date.UTC(period === 'year' ? year + offset + 1 : year, period === 'month' ? month + offset : 0, 1) -
        SEOUL_OFFSET
  const startDay = dayKey(start)
  const endDay = dayKey(end - 1)
  const labels = period === 'week'
    ? ['지난주', '이번 주', '다음 주', '해당 주']
    : period === 'month' ? ['지난달', '이번 달', '다음 달', '해당 월'] : ['작년', '올해', '내년', '해당 연도']
  const label = labels[offset === -1 ? 0 : offset === 0 ? 1 : offset === 1 ? 2 : 3]!
  const showYear = startDay.slice(0, 4) !== today.slice(0, 4) || endDay.slice(0, 4) !== today.slice(0, 4)
  const dateLabel =
    period === 'week'
      ? `${(showYear ? startDay : startDay.slice(5)).replaceAll('-', '.')} – ${(showYear ? endDay : endDay.slice(5)).replaceAll('-', '.')}`
      : period === 'month'
        ? `${Number(startDay.slice(0, 4))}년 ${Number(startDay.slice(5, 7))}월`
        : `${Number(startDay.slice(0, 4))}년`
  return { period, start, end, startDay, endDay, today, label, dateLabel }
}

export function periodDays(range: RecordRange) {
  return Array.from({ length: Math.round((range.end - range.start) / DAY) }, (_, i) =>
    dayKey(range.start + i * DAY),
  )
}

export function recordsInRange(records: readonly StudyRecord[], range: RecordRange) {
  return records
    .filter((record) => record.endedAt >= range.start && record.endedAt < range.end)
    .sort((a, b) => b.endedAt - a.endedAt)
}

export function recordSummary(records: readonly StudyRecord[]) {
  const seconds = records.reduce((total, record) => total + record.studySeconds, 0)
  const focus = records.reduce((total, record) => total + record.focusSeconds, 0)
  return {
    seconds,
    focusRate: seconds ? Math.min(100, Math.round((focus / seconds) * 1000) / 10) : 0,
    sessions: records.length,
    companions: new Set(records.flatMap((record) => record.characterIds)).size,
  }
}
