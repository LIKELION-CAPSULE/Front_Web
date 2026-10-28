import type { StudyRecord } from '../demo/types.ts'
import { dayKey } from '../../shared/lib/format.ts'
import { periodDays, recordsInRange, type RecordRange } from './record-period.ts'
import { focusMeasuredSeconds, focusPercent } from '../session/focus.ts'

export type TimeBucket = { key: string; label: string; tick: string; future: boolean }
export type CompanionSeries = {
  id: string
  name: string
  seconds: number
  focusRate: number | null
  points: { seconds: number | null; cumulativeSeconds: number | null; focusRate: number | null }[]
}

export function companionTimeSeries(
  records: readonly StudyRecord[],
  characters: readonly { id: string; name: string }[],
  range: RecordRange,
) {
  const annual = range.period === 'year'
  const keys = annual
    ? Array.from(
        { length: 12 },
        (_, index) => `${range.startDay.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`,
      )
    : periodDays(range)
  const buckets: TimeBucket[] = keys.map((key) => ({
    key,
    label: annual
      ? `${Number(key.slice(0, 4))}년 ${Number(key.slice(5))}월`
      : `${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일`,
    tick: annual ? `${Number(key.slice(5))}월` : `${Number(key.slice(8))}일`,
    future: key > (annual ? range.today.slice(0, 7) : range.today),
  }))
  const included = recordsInRange(records, range)
  const unique = [...new Map(characters.map((character) => [character.id, character])).values()]
  const series: CompanionSeries[] = unique.map((character) => {
    const totals = keys.map(() => ({ seconds: 0, focus: 0, observed: 0 }))
    for (const record of included) {
      if (!record.characterIds.includes(character.id)) continue
      const key = dayKey(record.endedAt).slice(0, annual ? 7 : 10)
      const index = keys.indexOf(key)
      if (index < 0) continue
      // Shared sessions are apportioned once, matching companion relationship totals.
      const share = Math.max(1, record.characterIds.length)
      totals[index]!.seconds += record.studySeconds / share
      totals[index]!.focus += record.focusSeconds / share
      totals[index]!.observed += focusMeasuredSeconds(record) / share
    }
    const seconds = totals.reduce((sum, total) => sum + total.seconds, 0)
    const focus = totals.reduce((sum, total) => sum + total.focus, 0)
    const observed = totals.reduce((sum, total) => sum + total.observed, 0)
    let cumulative = 0
    return {
      ...character,
      seconds,
      focusRate: focusPercent(focus, observed) ?? (seconds ? null : 0),
      points: totals.map((total, index) => {
        cumulative += total.seconds
        return {
          seconds: buckets[index]!.future ? null : total.seconds,
          cumulativeSeconds: buckets[index]!.future ? null : cumulative,
          focusRate: focusPercent(total.focus, total.observed) ?? (total.seconds ? null : 0),
        }
      }),
    }
  })
  return {
    buckets,
    series: series.filter((item) => item.seconds > 0).sort((a, b) => b.seconds - a.seconds),
  }
}
