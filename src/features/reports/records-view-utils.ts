import type { RecordPeriod } from './record-period.ts'

export function parseRecordsParams(searchParams: URLSearchParams): {
  period: RecordPeriod
  offset: number
  mate: string | null
} {
  const rawPeriod = searchParams.get('period')
  const period: RecordPeriod =
    rawPeriod === 'month' || rawPeriod === 'year' ? rawPeriod : 'week'
  const rawOffset = Number(searchParams.get('offset'))
  const offset = Number.isInteger(rawOffset) ? rawOffset : 0
  const rawMate = searchParams.get('mate')?.trim()
  const mate = rawMate && rawMate !== 'all' ? rawMate : null
  return { period, offset, mate }
}
