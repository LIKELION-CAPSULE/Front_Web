import { timeBand, timeBandLabels, type TimeBand } from '../../records/mate-comment.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

/**
 * What a capsule remembers about its connection, besides how long it was (pure, unit-tested):
 *
 * - **Time band** of the connection: the records' own rule (`timeBand` in records/mate-comment.ts, the Seoul hour of
 *   the connection's *start*: 새벽 0–5 · 아침 5–11 · 낮 11–17 · 저녁 17–21 · 밤 21–24). It tints the capsules of that
 *   connection (capsule-jar-theme.ts `capsuleBandTheme`).
 * - **Keepsake**: the connection during which the time together, added up from the first connection, passed a
 *   milestone (`CAPSULE_MILESTONE_HOURS`). One of its capsules — the one for the part of the connection where the
 *   milestone was passed — becomes a keepsake capsule.
 */

/**
 * Milestones of the time together (hours). Two-week opening: a usual user (5–15 connections of 30 min–1.5 h,
 * 5–15 hours) reaches 1, 3, 5 and often 10 hours, so 3–4 keepsakes; a keen one (30–50 connections) also 20 and
 * 30 hours. 50 and 100 hours are for those who stay.
 */
export const CAPSULE_MILESTONE_HOURS = [1, 3, 5, 10, 20, 30, 50, 100] as const

export type { TimeBand }
export const capsuleBandLabels = timeBandLabels

/** Time band of a connection by its start (the records' rule). */
export function capsuleBand(capsule: Pick<CapsuleRecord, 'startedAt'>): TimeBand {
  return timeBand(capsule.startedAt)
}

export type CapsuleKeepsake = {
  /** The connection (bundle) id. */
  connectionId: string
  /** The milestone passed in this connection (the highest one when a single long connection passes several). */
  hours: number
  /** Index of the keepsake capsule in the connection's bundle (0 … pieces − 1). */
  piece: number
}

const endOf = (capsule: CapsuleRecord) => capsule.endedAt ?? capsule.startedAt + Math.max(0, capsule.durationSeconds) * 1000

/**
 * Keepsake capsules by connection id. Connections are added up in the order they started (ties by id); a connection
 * that has not ended by `now` is left out (and so does not count toward later milestones either). `piecesOf` is the
 * bundle size of a connection (capsule-floor-layout.ts `capsulesForConnection`).
 */
export function capsuleKeepsakes(
  capsules: readonly CapsuleRecord[],
  piecesOf: (durationSeconds: number) => number,
  { now = Number.POSITIVE_INFINITY, milestones = CAPSULE_MILESTONE_HOURS }: { now?: number; milestones?: readonly number[] } = {},
): Map<string, CapsuleKeepsake> {
  const result = new Map<string, CapsuleKeepsake>()
  const ordered = capsules
    .filter((capsule) => endOf(capsule) <= now)
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
  let total = 0
  for (const capsule of ordered) {
    const seconds = Math.max(0, capsule.durationSeconds)
    if (seconds <= 0) continue
    const before = total
    total += seconds
    let passed = 0
    for (const hours of milestones) if (before < hours * 3600 && hours * 3600 <= total) passed = Math.max(passed, hours)
    if (!passed) continue
    const pieces = Math.max(1, piecesOf(seconds))
    // The capsule for the stretch of the connection in which the milestone was reached.
    const share = (passed * 3600 - before) / seconds
    const piece = Math.min(pieces - 1, Math.max(0, Math.ceil(share * pieces) - 1))
    result.set(capsule.id, { connectionId: capsule.id, hours: passed, piece })
  }
  return result
}

/** 「함께한 지 10시간!」 */
export function keepsakeTitle(hours: number) {
  return `함께한 지 ${hours}시간!`
}
