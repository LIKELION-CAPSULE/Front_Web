
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

/** Relation figures of the development samples (mate-sample-data.ts). Production reads 37 (use-my-mates.ts). */
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

/** Unlocked / all expressions, for the 표정 컬렉션 title. */
export const expressionCount = (expressions: readonly MateExpressionUnlock[]) => ({
  unlocked: expressions.filter((item) => item.unlocked).length,
  total: expressions.length,
})
