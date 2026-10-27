import { dayKey } from '../../shared/lib/format.ts'
import type { StudyRecord } from '../demo/types.ts'
import { periodDays, type RecordRange } from './record-period.ts'

export function studyHeatmap(records: readonly StudyRecord[], range: RecordRange) {
  const totals = new Map<string, number>()
  for (const record of records) {
    const key = dayKey(record.endedAt)
    totals.set(key, (totals.get(key) ?? 0) + record.studySeconds)
  }
  const days = periodDays(range)
  const offset = (new Date(`${range.startDay}T12:00:00+09:00`).getUTCDay() + 6) % 7
  const annual = range.period === 'year'
  const cells = days.map((day, index) => {
    const seconds = totals.get(day) ?? 0
    return {
      day,
      seconds,
      level: seconds ? Math.min(4, Math.floor(seconds / 1800) + 1) : 0,
      column: annual ? Math.floor((offset + index) / 7) : (offset + index) % 7,
      row: annual ? (offset + index) % 7 : Math.floor((offset + index) / 7),
      disabled: day > range.today,
    }
  })
  return {
    cells,
    annual,
    columns: annual ? Math.ceil((offset + days.length) / 7) : 7,
    rows: annual ? 7 : Math.ceil((offset + days.length) / 7),
    attended: cells.filter((cell) => cell.seconds > 0).length,
  }
}
