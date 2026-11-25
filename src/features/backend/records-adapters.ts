import { ApiError } from '../../shared/api/client.ts'
import type {
  MateUnlock, MyMate, MyMateRecent, MyMatesResponse, RecordBucket, RecordMateSummary, RecordRecent, RecordsResponse,
  StudySettlement,
} from '../../shared/api/types.ts'
import { settlement } from './adapters.ts'

/**
 * 37 내 메이트 · 38 내 기록 → the screens' views (docs/BACKEND_API.md 11-25). Like `adapters.ts`: a missing or malformed
 * required field fails the whole response (502, the screen shows its error state); optional fields take defaults.
 * Unknown values of open enums (an unlock `type`) are skipped, not fatal.
 */

const invalid = (what: string) => new ApiError(`${what} 응답을 확인하지 못했어요.`, 502)
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const isSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
const time = (value: unknown) => {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY = /^\d{4}-\d{2}$/

// ── 37 ────────────────────────────────────────────────────────────────────────────────────────

export type MyMateUnlockView = {
  id: string
  type: 'EXPRESSION' | 'VOICE_LINE'
  title: string
  unlockStage: number | null
  unlockStageName: string | null
  /** The model's expression name (`shy`, …); null for voice lines. */
  expressionName: string | null
  assetUrl: string | null
  unlocked: boolean
}
export type MyMateConnection = { connectionId: string; endedAt: number; presentSeconds: number; connectedSeconds: number }
export type MyMateView = {
  /** Server mate id(s): one persona may come twice (서진 id 2 · 3, merged by the caller). */
  serverIds: readonly number[]
  name: string
  cardImageUrl: string | null
  firstMetAt: number | null
  lastConnectedAt: number | null
  connectionCount: number
  totalPresentSeconds: number
  totalConnectedSeconds: number
  /** 0–1 progress (adapters.settlement), or null without a stage. */
  relation: StudySettlement | null
  unlocks: readonly MyMateUnlockView[]
  /** Newest first, at most 5. */
  recent: readonly MyMateConnection[]
}

function recentConnection(value: MyMateRecent, what: string): MyMateConnection {
  const endedAt = time(value?.endedAt)
  if (!isId(value?.connectionId) || endedAt === null || !isSeconds(value.connectedSeconds)) throw invalid(what)
  return {
    connectionId: String(value.connectionId), endedAt, connectedSeconds: value.connectedSeconds,
    presentSeconds: isSeconds(value.presentSeconds) ? value.presentSeconds : 0,
  }
}

function unlock(value: MateUnlock): MyMateUnlockView | null {
  const type = value?.type === 'EXPRESSION' || value?.type === 'VOICE_LINE' ? value.type as MyMateUnlockView['type'] : null
  if (!type) return null
  if (!isId(value.id) || !text(value.title) || typeof value.unlocked !== 'boolean') throw invalid('내 메이트')
  return {
    id: String(value.id), type, title: text(value.title)!,
    unlockStage: isCount(value.unlockStage) ? value.unlockStage : null,
    unlockStageName: text(value.unlockStageName) ?? null,
    expressionName: text(value.expressionName) ?? null,
    assetUrl: text(value.assetUrl) ?? null,
    unlocked: value.unlocked,
  }
}

export function myMate(value: MyMate): MyMateView {
  if (!isId(value?.id) || !text(value.name) || !isCount(value.connectionCount) ||
    !isSeconds(value.totalPresentSeconds) || !isSeconds(value.totalConnectedSeconds)) throw invalid('내 메이트')
  if (value.unlocks !== undefined && !Array.isArray(value.unlocks)) throw invalid('내 메이트')
  if (value.recent !== undefined && !Array.isArray(value.recent)) throw invalid('내 메이트')
  const relation = settlement(value.relation)
  return {
    serverIds: [value.id],
    name: text(value.name)!,
    cardImageUrl: text(value.cardImageUrl) ?? null,
    firstMetAt: time(value.firstMetAt),
    lastConnectedAt: time(value.lastConnectedAt),
    connectionCount: value.connectionCount,
    totalPresentSeconds: value.totalPresentSeconds,
    totalConnectedSeconds: value.totalConnectedSeconds,
    relation: relation && typeof relation.stage === 'number' ? relation : null,
    unlocks: (value.unlocks ?? []).map(unlock).filter((item): item is MyMateUnlockView => item !== null),
    recent: (value.recent ?? []).map(item => recentConnection(item, '내 메이트')).sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
  }
}

/** 37 → one view per server mate, in the server's order (most recent connection first). */
export function myMates(dto: MyMatesResponse | null | undefined): MyMateView[] {
  if (!dto || !Array.isArray(dto.mates)) throw invalid('내 메이트')
  return dto.mates.map(myMate)
}

/**
 * Two server entries of one persona (서진 id 2 · 3) as one mate: counts and times add up, the dates widen, the recent
 * connections merge (newest 5), and the relation and unlocks are those of the entry met most recently.
 */
export function mergeMyMates(entries: readonly MyMateView[]): MyMateView {
  if (entries.length === 1) return entries[0]!
  const latest = entries.slice().sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0))[0]!
  const dates = (pick: (entry: MyMateView) => number | null, choose: (...values: number[]) => number) => {
    const values = entries.map(pick).filter((value): value is number => value !== null)
    return values.length ? choose(...values) : null
  }
  return {
    ...latest,
    serverIds: entries.flatMap(entry => entry.serverIds),
    firstMetAt: dates(entry => entry.firstMetAt, Math.min),
    lastConnectedAt: dates(entry => entry.lastConnectedAt, Math.max),
    connectionCount: entries.reduce((sum, entry) => sum + entry.connectionCount, 0),
    totalPresentSeconds: entries.reduce((sum, entry) => sum + entry.totalPresentSeconds, 0),
    totalConnectedSeconds: entries.reduce((sum, entry) => sum + entry.totalConnectedSeconds, 0),
    recent: entries.flatMap(entry => entry.recent).sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
  }
}

// ── 38 ────────────────────────────────────────────────────────────────────────────────────────

export type RecordsBucketView = { key: string; presentSeconds: number; connectedSeconds: number }
export type RecordsMateView = { mateId: number; name: string; presentSeconds: number; connectedSeconds: number; connectionCount: number; stage: number | null }
export type RecordsConnectionView = MyMateConnection & { mateId: number; mateName: string }
export type RecordsView = {
  from: string
  to: string
  totalPresentSeconds: number
  totalConnectedSeconds: number
  connectedDays: number
  connectionCount: number
  /** Days (`YYYY-MM-DD`; a YEAR response has months `YYYY-MM`), every one of the range, empty ones at 0. */
  buckets: readonly RecordsBucketView[]
  mates: readonly RecordsMateView[]
  /** Newest first, at most 5. */
  recent: readonly RecordsConnectionView[]
}

function bucket(value: RecordBucket): RecordsBucketView {
  if (typeof value?.key !== 'string' || !(DAY_KEY.test(value.key) || MONTH_KEY.test(value.key)) ||
    !isSeconds(value.presentSeconds) || !isSeconds(value.connectedSeconds)) throw invalid('내 기록')
  return { key: value.key, presentSeconds: value.presentSeconds, connectedSeconds: value.connectedSeconds }
}
function recordMate(value: RecordMateSummary): RecordsMateView {
  if (!isId(value?.mateId) || !text(value.name) || !isSeconds(value.presentSeconds) || !isSeconds(value.connectedSeconds) ||
    !isCount(value.connectionCount)) throw invalid('내 기록')
  return {
    mateId: value.mateId, name: text(value.name)!, presentSeconds: value.presentSeconds, connectedSeconds: value.connectedSeconds,
    connectionCount: value.connectionCount, stage: isCount(value.stage) ? value.stage : null,
  }
}
function recordRecent(value: RecordRecent): RecordsConnectionView {
  const base = recentConnection(value, '내 기록')
  if (!isId(value.mateId)) throw invalid('내 기록')
  return { ...base, mateId: value.mateId, mateName: text(value.mateName) ?? '' }
}

export function records(dto: RecordsResponse | null | undefined): RecordsView {
  if (!dto || typeof dto.from !== 'string' || !DAY_KEY.test(dto.from) || typeof dto.to !== 'string' || !DAY_KEY.test(dto.to) ||
    !isSeconds(dto.totalPresentSeconds) || !isSeconds(dto.totalConnectedSeconds) || !isCount(dto.connectedDays) ||
    !isCount(dto.connectionCount) || !Array.isArray(dto.buckets)) throw invalid('내 기록')
  if (dto.mates !== undefined && !Array.isArray(dto.mates)) throw invalid('내 기록')
  if (dto.recent !== undefined && !Array.isArray(dto.recent)) throw invalid('내 기록')
  return {
    from: dto.from, to: dto.to,
    totalPresentSeconds: dto.totalPresentSeconds, totalConnectedSeconds: dto.totalConnectedSeconds,
    connectedDays: dto.connectedDays, connectionCount: dto.connectionCount,
    buckets: dto.buckets.map(bucket),
    mates: (dto.mates ?? []).map(recordMate),
    recent: (dto.recent ?? []).map(recordRecent).sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
  }
}

/**
 * Several answers as one: the months of a year read with MONTH (so the year board keeps its days), or one range read for
 * the two server entries of one persona. Sums; buckets added up by key (in date order); mates added up by id; the
 * newest 5 connections. Connected days add up: exact across months, at most an overestimate for one persona's two ids.
 */
export function mergeRecords(parts: readonly RecordsView[]): RecordsView {
  if (!parts.length) throw invalid('내 기록')
  const mates = new Map<number, RecordsMateView>()
  for (const part of parts) {
    for (const mate of part.mates) {
      const previous = mates.get(mate.mateId)
      mates.set(mate.mateId, previous ? {
        ...previous,
        presentSeconds: previous.presentSeconds + mate.presentSeconds,
        connectedSeconds: previous.connectedSeconds + mate.connectedSeconds,
        connectionCount: previous.connectionCount + mate.connectionCount,
        stage: mate.stage ?? previous.stage,
      } : mate)
    }
  }
  const sum = (pick: (part: RecordsView) => number) => parts.reduce((total, part) => total + pick(part), 0)
  const sorted = parts.slice().sort((a, b) => a.from.localeCompare(b.from))
  return {
    from: sorted[0]!.from, to: sorted.at(-1)!.to,
    totalPresentSeconds: sum(part => part.totalPresentSeconds), totalConnectedSeconds: sum(part => part.totalConnectedSeconds),
    connectedDays: sum(part => part.connectedDays), connectionCount: sum(part => part.connectionCount),
    buckets: sumBuckets(sorted.flatMap(part => part.buckets)),
    mates: [...mates.values()],
    recent: parts.flatMap(part => part.recent).sort((a, b) => b.endedAt - a.endedAt).slice(0, 5),
  }
}

function sumBuckets(buckets: readonly RecordsBucketView[]): RecordsBucketView[] {
  const byKey = new Map<string, RecordsBucketView>()
  for (const item of buckets) {
    const previous = byKey.get(item.key)
    byKey.set(item.key, previous
      ? { key: item.key, presentSeconds: previous.presentSeconds + item.presentSeconds, connectedSeconds: previous.connectedSeconds + item.connectedSeconds }
      : item)
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}
