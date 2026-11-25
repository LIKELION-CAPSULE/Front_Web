
export type MateVoiceUnlock = {
  id: string
  text: string
  audioUrl?: string
  unlocked: boolean
  condition?: string
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
