import type { StudyRecord } from '../demo/types.ts'
import type { RecordsRange, ReportResponse } from '../../shared/api/types.ts'
import type { RecordsConnectionView, RecordsView } from '../backend/records-adapters.ts'
import type { RecordRange } from '../reports/record-period.ts'
import { connectionDayKey } from './connection-day.ts'

/**
 * 38 내 기록 → what the records page draws. 38 gives sums, a bucket per day (a YEAR answer: per month, so the year is
 * read month by month to keep its days), per-mate sums and the newest five connections — not every connection. The board,
 * the calendar and the comment still take connection records, so:
 *
 * - each day with time becomes one **day record** per mate (that day's bucket from the mate's own 38 answer);
 * - the newest five connections replace their day's record with the real connections (exact times, a record card that
 *   opens and links to the connection record); time of the day left over from older connections stays a day record.
 *
 * The day totals are always the server's buckets: a listed connection only takes its share of a bucket, never adds
 * time. 38 `recent[]` has no start yet (requested: `startedAt`, read when sent), and its end minus its connected time is
 * only an estimate — time cut off mid-connection is not connected time, so near the 05:00 day boundary the estimate can
 * fall on the next day while the server counted the connection on the day it began. A listed connection is therefore
 * shown on its (estimated) day only when that mate's bucket there still has room for it; otherwise its time stays in
 * the bucket's day record, on the day the server put it. Connections of other mates or outside the range add nothing.
 *
 * Day records start at noon of their day (38 has no time of day): they never open a record card, and the time-band
 * tint of those days is the day band. See docs in the report (`API wiring 1`).
 */

/** A launch mate on the records page, with its server mate id(s) (one persona may have two: 서진 id 2 · 3). */
export type RecordsMate = { id: string; characterId: string; name: string; serverIds: readonly number[] }

export type RecordsData = {
  /** The range and mate filter (`RecordsMate.id`, null: 전체) this answer is for. */
  range: RecordRange
  mateId: string | null
  /** Sums of the whole scope (all mates, or the chosen one). */
  totals: RecordsView
  /** Day records and real connections (the newest five of the scope), oldest first. */
  records: readonly StudyRecord[]
  /** Mates with time in this range. */
  matesInRange: number
  /** Each read mate's own 38 answer for the range (by mate id): the records comment speaks from these sums. */
  views: Readonly<Record<string, RecordsView>>
}

/** The 38 reads for a range: one WEEK / MONTH read, or the started months of a year. */
export function recordsRequests(range: RecordRange): { range: RecordsRange; date: string }[] {
  if (range.period === 'week') return [{ range: 'WEEK', date: range.startDay }]
  if (range.period === 'month') return [{ range: 'MONTH', date: range.startDay }]
  const year = range.startDay.slice(0, 4)
  const months: { range: RecordsRange; date: string }[] = []
  for (let month = 1; month <= 12; month++) {
    const date = `${year}-${String(month).padStart(2, '0')}-01`
    if (date > range.today) break
    months.push({ range: 'MONTH', date: date < range.startDay ? range.startDay : date })
  }
  return months.length ? months : [{ range: 'MONTH', date: range.startDay }]
}

const NOON = 'T12:00:00+09:00'

function report(mate: RecordsMate | undefined, values: { connectionId?: number; startedAt: number; endedAt: number; connectedSeconds: number; presentSeconds: number }): ReportResponse {
  return {
    ...(values.connectionId ? { connectionId: values.connectionId } : {}),
    startedAt: new Date(values.startedAt).toISOString(), endedAt: new Date(values.endedAt).toISOString(),
    connectedSeconds: values.connectedSeconds, presentSeconds: values.presentSeconds,
    ...(mate ? { mate: { id: mate.serverIds[0], name: mate.name } } : {}),
  }
}

function record(id: string, mate: RecordsMate | undefined, startedAt: number, connectedSeconds: number, presentSeconds: number, connectionId?: number, endedAt = startedAt + connectedSeconds * 1000): StudyRecord {
  const characterId = mate?.characterId ?? ''
  return {
    id, roomId: characterId, characterIds: [characterId], tier: 'basic',
    ...(mate ? { roomName: mate.name, characterName: mate.name } : {}),
    serverReport: report(mate, { connectionId, startedAt, endedAt, connectedSeconds, presentSeconds }),
    // 38 `presentSeconds` = camera on and the face seen: the camera time of the records page.
    ...(presentSeconds > 0 ? { cameraFocus: { observedMs: presentSeconds * 1000, focusedMs: presentSeconds * 1000, returns: 0 } } : {}),
    startedAt, endedAt, studySeconds: connectedSeconds, focusSeconds: presentSeconds, awaySeconds: 0, returns: 0,
    completed: false, automatic: false,
  }
}

/**
 * A real connection (38 `recent[]`) as a record: its start is the server's when sent, else its end minus its connection
 * time (an estimate: see the module comment).
 */
export function connectionRecord(connection: RecordsConnectionView, mate: RecordsMate | undefined): StudyRecord {
  const startedAt = connection.startedAt ?? connection.endedAt - connection.connectedSeconds * 1000
  return record(connection.connectionId, mate, startedAt, connection.connectedSeconds, connection.presentSeconds, Number(connection.connectionId), connection.endedAt)
}

/** A record built from a day bucket (no single connection behind it): never opens a record card. */
export const isDayRecord = (value: Pick<StudyRecord, 'id'>) => value.id.startsWith('day:')

/**
 * Day records of each mate's buckets, with the real connections put in their place (see the module comment).
 * `parts`: each mate's own 38 answer for the range; `recent`: the scope's newest connections (newest first).
 * The board's day totals are the buckets', whatever `recent` holds.
 */
export function boardRecords(parts: readonly { mate: RecordsMate; view: RecordsView }[], recent: readonly StudyRecord[]): StudyRecord[] {
  const result: StudyRecord[] = []
  for (const { mate, view } of parts) {
    /** What is left of each day's bucket once its listed connections took their share. */
    const left = new Map(view.buckets.filter(bucket => bucket.key.length === 10).map(bucket => [bucket.key, { connected: bucket.connectedSeconds, present: bucket.presentSeconds, real: 0 }]))
    for (const item of recent) {
      if (item.characterIds[0] !== mate.characterId) continue
      const day = left.get(connectionDayKey(item))
      // No bucket (another range) or no room for it there (the server counted it on another day): its time is in the
      // buckets already, so it is not shown on its own. One second of slack for the server's rounding.
      if (!day || item.studySeconds > day.connected + 1) continue
      day.connected = Math.max(0, day.connected - item.studySeconds)
      day.present = Math.max(0, day.present - item.focusSeconds)
      day.real++
      result.push(item)
    }
    for (const [key, day] of left) {
      // The day's time beyond its listed connections (older ones of the same day). A rounding second is not a capsule.
      if (!(day.connected > 0) || (day.connected < 60 && day.real)) continue
      result.push(record(`day:${mate.id}:${key}`, mate, Date.parse(`${key}${NOON}`), day.connected, day.present))
    }
  }
  return result.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
}

/** The summary row of the records page from 38's sums. */
export function recordsSummary(totals: RecordsView, range: RecordRange, isCurrentPeriod: boolean, mates: number) {
  const periodPrefix = isCurrentPeriod
    ? range.period === 'week' ? '이번 주' : range.period === 'month' ? '이번 달' : '올해'
    : range.dateLabel
  return {
    primaryLabel: `${periodPrefix} 함께한 시간`,
    primarySeconds: totals.totalConnectedSeconds,
    cameraSeconds: totals.totalPresentSeconds,
    activeDays: totals.connectedDays,
    sessions: totals.connectionCount,
    mates,
  }
}
