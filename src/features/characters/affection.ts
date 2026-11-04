import type { DemoState } from '../demo/types.ts'

/** The backend owns initial scores and interaction rules; missing scores stay unknown. */
export function normalizeAffectionScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null
}

export function normalizeAffectionScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, score]) => {
    const normalized = normalizeAffectionScore(score)
    return id.trim() && normalized !== null ? [[id, normalized]] : []
  }))
}

export function affectionScore(state: Pick<DemoState, 'affection'>, characterId: string) {
  return normalizeAffectionScore(state.affection?.[characterId])
}

export function migrateAffection(state: DemoState): DemoState {
  return { ...state, affection: normalizeAffectionScores(state.affection) }
}
