import { dayKey } from '../../shared/lib/format.ts'
import type { DemoState, StudyRecord } from './types'

export function todaySeconds(state: DemoState, now = Date.now()) {
  return state.records
    .filter((record) => dayKey(record.endedAt) === dayKey(now))
    .reduce((sum, record) => sum + record.studySeconds, 0)
}

export function recordSeconds(records: StudyRecord[]) {
  return records.reduce((sum, record) => sum + record.studySeconds, 0)
}

export const RELATIONSHIP_LEVEL_MINUTES = 600
export const MAX_RELATIONSHIP_LEVEL = 5

export function characterStudySeconds(state: Pick<DemoState, 'records'>, characterId: string) {
  return state.records
    .filter((record) => record.characterIds.includes(characterId))
    .reduce(
      (sum, record) =>
        sum + Math.round(record.studySeconds / Math.max(1, record.characterIds.length)),
      0,
    )
}

export function relationship(state: DemoState, characterId: string) {
  const minutes = Math.floor(characterStudySeconds(state, characterId) / 60)
  const level = Math.min(MAX_RELATIONSHIP_LEVEL, 1 + Math.floor(minutes / RELATIONSHIP_LEVEL_MINUTES))
  return {
    level,
    minutes,
    next: level === MAX_RELATIONSHIP_LEVEL ? 0 : RELATIONSHIP_LEVEL_MINUTES - (minutes % RELATIONSHIP_LEVEL_MINUTES),
    progress: level === MAX_RELATIONSHIP_LEVEL ? 100 : ((minutes % RELATIONSHIP_LEVEL_MINUTES) / RELATIONSHIP_LEVEL_MINUTES) * 100,
  }
}
