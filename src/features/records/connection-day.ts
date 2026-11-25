import type { StudyRecord } from '../demo/types.ts'
import { businessDay } from '../../shared/lib/format.ts'

/**
 * One date rule for a connection everywhere records are shown (records page summary, comment, calendar and list;
 * my-mates capsules): a connection belongs to the day it **started**, a day running from 05:00 to 05:00 Seoul time —
 * the server's rule for 38 내 기록 (docs/BACKEND_API.md `RecordsResponse`). A connection from 23:30 to 00:40, or one
 * that starts at 02:00, is the evening's connection.
 *
 * Only completed connections count: `endedAt <= now`. A record whose end lies in the future (clock skew, a session
 * still running) is left out of every view until it has ended.
 */

type Timed = Pick<StudyRecord, 'startedAt' | 'endedAt'>

const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/** Representative time of a connection: its start (the end only when the start is missing). */
export function connectionStartedAt(record: Timed): number {
  return valid(record.startedAt) ? record.startedAt : record.endedAt
}

/** The day (`YYYY-MM-DD`, from 05:00 Seoul time) of a connection. */
export function connectionDayKey(record: Timed): string {
  return businessDay(connectionStartedAt(record))
}

export function isCompletedRecord(record: Timed, now: number): boolean {
  return valid(record.endedAt) && record.endedAt <= now
}

export function completedRecords<T extends Timed>(records: readonly T[], now: number): T[] {
  return records.filter((record) => isCompletedRecord(record, now))
}

/** Newest connection first (by start). */
export function byConnectionStartDesc(a: Timed, b: Timed): number {
  return connectionStartedAt(b) - connectionStartedAt(a)
}
