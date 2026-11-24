import type { StudyRecord } from '../demo/types.ts'
import { duration } from '../../shared/lib/format.ts'
import { connectionDayKey } from '../records/connection-day.ts'
import { cameraRecords, connectionSummary } from './connection-records.ts'
import type { RecordPeriod, RecordRange } from './record-period.ts'

export type RecordsSummaryDisplay = {
  /** "이번 주 함께한 시간" — 함께한 시간 is the connection time. */
  primaryLabel: string
  primarySeconds: number
  /** "카메라로 함께한 시간 …", or null when no camera time was measured. */
  cameraCaption: string | null
  cameraSeconds: number
  connectionSeconds: number
  activeDays: number
  sessions: number
  mates: number
}

/**
 * Summary card values for /records. The headline is always the connection time (shown as "함께한 시간"),
 * so users with the camera off still see their records. Camera-measured time is a secondary caption only.
 */
export function resolveSummaryDisplay(
  records: readonly StudyRecord[],
  range: RecordRange,
  isCurrentPeriod: boolean,
): RecordsSummaryDisplay {
  const summary = connectionSummary(records)
  const cameraSeconds = cameraRecords(records).reduce((sum, record) => sum + record.studySeconds, 0)
  const connectionSeconds = summary.connectionSeconds ?? 0
  const periodPrefix = isCurrentPeriod
    ? range.period === 'week'
      ? '이번 주'
      : range.period === 'month'
        ? '이번 달'
        : '올해'
    : range.dateLabel

  return {
    primaryLabel: `${periodPrefix} 함께한 시간`,
    primarySeconds: connectionSeconds,
    cameraCaption: cameraSeconds > 0 ? `카메라로 함께한 시간 ${duration(cameraSeconds)}` : null,
    cameraSeconds,
    connectionSeconds,
    activeDays: new Set(records.map((record) => connectionDayKey(record))).size,
    sessions: summary.sessions ?? 0,
    mates: summary.mates ?? 0,
  }
}

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
