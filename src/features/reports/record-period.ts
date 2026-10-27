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

export function getRecordRange(period: RecordPeriod, now = Date.now()) {
  const today = dayKey(now)
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const midnight = Date.UTC(year, month - 1, day) - SEOUL_OFFSET
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const start =
    period === 'week'
      ? midnight - ((weekday + 6) % 7) * DAY
      : Date.UTC(year, period === 'month' ? month - 1 : 0, 1) - SEOUL_OFFSET
  const end =
    period === 'week'
      ? start + 7 * DAY
      : Date.UTC(period === 'year' ? year + 1 : year, period === 'month' ? month : 0, 1) -
        SEOUL_OFFSET
  const startDay = dayKey(start)
  const endDay = dayKey(end - 1)
  const label = period === 'week' ? '이번 주' : period === 'month' ? '이번 달' : '올해'
  const dateLabel =
    period === 'week'
      ? `${startDay.slice(5).replace('-', '.')} – ${endDay.slice(5).replace('-', '.')}`
      : period === 'month'
        ? `${year}년 ${month}월`
        : `${year}년`
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
