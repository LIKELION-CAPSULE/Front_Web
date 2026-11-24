import type { StudyRecord } from '../demo/types.ts'
import type { StudySettlement } from '../../shared/api/types.ts'
import { focusDetectedSeconds } from '../session/focus.ts'

export type MateExpressionUnlock = {
  id: string
  label: string
  /** Existing Live2D model expression file (e.g. 'files/009.exp3.json'). */
  expressionFile: string
  unlocked: boolean
  unlockedAt?: number
  condition?: string
  /** Affinity stage that unlocks it, when known (links the collection to the stage progress). */
  unlockStage?: number
  /** That stage's name, e.g. "친한 친구": the short text on a locked tile (the full `condition` is its label). */
  unlockStageName?: string
}

export type MateVoiceUnlock = {
  id: string
  text: string
  audioUrl?: string
  unlocked: boolean
  condition?: string
}

export type MateUnlocks = {
  expressions: readonly MateExpressionUnlock[]
  voices: readonly MateVoiceUnlock[]
}

/** Optional server-provided relation stats; when present and valid, take precedence over client aggregation. */
export type MateServerRelationStats = {
  togetherSeconds?: number
  connectionCount?: number
  firstMetAt?: number
  stageName?: string
  stageProgress?: number
  stageSeconds?: number
  stageTargetSeconds?: number
  nextStageName?: string
  nextLevelSeconds?: number
}

export type MateRecordSummary = {
  /** Sum of camera-measured seconds (or server override); null when unavailable or 0. */
  togetherSeconds: number | null
  /** Count of server-reported records (or server override); null when 0. */
  connectionCount: number | null
  /** Earliest record timestamp in ms (or server override); null when unavailable. */
  firstMetAt: number | null
  /** Latest relation metadata merged with optional server overrides. */
  relation: Partial<StudySettlement> | undefined
  /** Most recent records for this mate (up to 5, newest endedAt first). */
  recentRecords: readonly StudyRecord[]
  /** True when the mate has more than 5 server-reported records. */
  hasMoreRecords: boolean
  /** Total number of server-reported records for this mate. */
  totalRecordCount: number
}

function positiveFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Aggregates server-reported connection records for a single mate.
 * Server-provided optional stats take precedence when valid and positive.
 */
export function summarizeMateRecords(
  records: readonly StudyRecord[],
  characterId: string,
  serverStats?: MateServerRelationStats,
  maxRecent = 5,
): MateRecordSummary {
  const mateRecords = records
    .filter((record) => Boolean(record.serverReport) && record.characterIds.includes(characterId))
    .slice()
    .sort((a, b) => b.endedAt - a.endedAt)

  let measuredTogether = 0
  let earliestAt: number | null = null

  for (const record of mateRecords) {
    if (record.cameraFocus) {
      measuredTogether += focusDetectedSeconds(record)
    }
    const candidateAt =
      Number.isFinite(record.startedAt) && record.startedAt > 0
        ? record.startedAt
        : Number.isFinite(record.endedAt) && record.endedAt > 0
          ? record.endedAt
          : null
    if (candidateAt !== null && (earliestAt === null || candidateAt < earliestAt)) {
      earliestAt = candidateAt
    }
  }

  const serverTogether = positiveFinite(serverStats?.togetherSeconds)
  const togetherSeconds = serverTogether ?? (measuredTogether > 0 ? measuredTogether : null)

  const serverCount = positiveFinite(serverStats?.connectionCount)
  const connectionCount = serverCount ?? (mateRecords.length > 0 ? mateRecords.length : null)

  const serverFirstMet = positiveFinite(serverStats?.firstMetAt)
  const firstMetAt = serverFirstMet ?? earliestAt

  const latestServerRelation = mateRecords[0]?.serverReport?.relation
  const mergedRelation: Partial<StudySettlement> | undefined =
    latestServerRelation || serverStats
      ? {
          ...latestServerRelation,
          ...(serverStats?.stageName !== undefined ? { stageName: serverStats.stageName } : {}),
          ...(serverStats?.stageProgress !== undefined ? { stageProgress: serverStats.stageProgress } : {}),
          ...(serverStats?.stageSeconds !== undefined ? { stageSeconds: serverStats.stageSeconds } : {}),
          ...(serverStats?.stageTargetSeconds !== undefined
            ? { stageTargetSeconds: serverStats.stageTargetSeconds }
            : {}),
          ...(serverStats?.nextStageName !== undefined ? { nextStageName: serverStats.nextStageName } : {}),
          ...(serverStats?.nextLevelSeconds !== undefined ? { nextLevelSeconds: serverStats.nextLevelSeconds } : {}),
        }
      : undefined

  return {
    togetherSeconds,
    connectionCount,
    firstMetAt,
    relation: mergedRelation,
    recentRecords: mateRecords.slice(0, maxRecent),
    hasMoreRecords: mateRecords.length > maxRecent,
    totalRecordCount: mateRecords.length,
  }
}

/** Counts unlocked vs total unlock items (expressions + voices).
 * Returns null when unlocks data is absent or empty.
 */
export function countMateUnlocks(unlocks?: MateUnlocks | null): { unlocked: number; total: number } | null {
  if (!unlocks) return null
  const expressions = unlocks.expressions ?? []
  const voices = unlocks.voices ?? []
  const total = expressions.length + voices.length
  if (total === 0) return null
  const unlocked =
    expressions.filter((item) => item.unlocked).length +
    voices.filter((item) => item.unlocked).length
  return { unlocked, total }
}

export type LockedVoiceGroup = {
  condition: string
  count: number
  label: string
}

const FALLBACK_LOCKED_LABEL = '아직 열리지 않았어요'

function formatLockedVoiceGroupLabel(condition: string, count: number): string {
  if (!condition) return FALLBACK_LOCKED_LABEL
  if (condition.endsWith('단계에서 열려요')) {
    return condition.replace(/단계에서 열려요$/, `단계에서 ${count}개가 열려요`)
  }
  return count > 1 ? `${condition} (${count}개)` : condition
}

/**
 * Groups locked voice unlocks by their condition string, preserving first-seen order.
 * Unlocked items are excluded. Empty/blank conditions group under "아직 열리지 않았어요".
 */
export function groupLockedVoices(voices: readonly MateVoiceUnlock[]): LockedVoiceGroup[] {
  const order: string[] = []
  const counts = new Map<string, number>()

  for (const voice of voices) {
    if (voice.unlocked) continue
    const key = voice.condition?.trim() ?? ''
    if (!counts.has(key)) {
      order.push(key)
      counts.set(key, 1)
    } else {
      counts.set(key, counts.get(key)! + 1)
    }
  }

  return order.map((condition) => {
    const count = counts.get(condition)!
    return {
      condition,
      count,
      label: formatLockedVoiceGroupLabel(condition, count),
    }
  })
}

/** Formats a timestamp as YYYY.MM.DD in Asia/Seoul for "처음 만난 날". */
export function formatFirstMetDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp)
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}.${m}.${d}`
}

/** Orders connected mates so the most recently connected mate comes first. */
export function latestConnectedTimestamp(
  characterId: string,
  records: readonly StudyRecord[],
  isActive: boolean,
): number {
  if (isActive) return Number.MAX_SAFE_INTEGER
  let latest = 0
  for (const record of records) {
    if (record.serverReport && record.characterIds.includes(characterId) && record.endedAt > latest) {
      latest = record.endedAt
    }
  }
  return latest
}

/** Unlocked / all expressions, for the 표정 컬렉션 title. */
export const expressionCount = (expressions: readonly MateExpressionUnlock[]) => ({
  unlocked: expressions.filter((item) => item.unlocked).length,
  total: expressions.length,
})
