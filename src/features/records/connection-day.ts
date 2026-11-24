import type { StudyRecord } from '../demo/types.ts'
import { dayKey } from '../../shared/lib/format.ts'

/**
 * One date rule for a connection everywhere records are shown (records page summary, comment, calendar and list;
 * my-mates capsules): a connection belongs to the Seoul day it **started**. A connection from 23:30 to 00:40 is
 * the evening's connection; its date, weekday and time of day all come from the start.
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

/** Seoul calendar day (`YYYY-MM-DD`) of a connection. */
export function connectionDayKey(record: Timed): string {
  return dayKey(connectionStartedAt(record))
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
