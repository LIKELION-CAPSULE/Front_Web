import { dayKey } from '@/shared/lib/format'
import type { DemoState, StudyRecord } from './types'

export function todaySeconds(state: DemoState, now = Date.now()) {
  return state.records
    .filter((record) => dayKey(record.endedAt) === dayKey(now))
    .reduce((sum, record) => sum + record.studySeconds, 0)
}

export function recordSeconds(records: StudyRecord[]) {
  return records.reduce((sum, record) => sum + record.studySeconds, 0)
}

export function characterStudySeconds(state: DemoState, characterId: string) {
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
  return {
    level: Math.min(5, 1 + Math.floor(minutes / 600)),
    minutes,
    next: 600 - (minutes % 600),
    progress: ((minutes % 600) / 600) * 100,
  }
}
