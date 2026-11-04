import type { DemoState, StudyRecord } from './types'

export function recordSeconds(records: StudyRecord[]) {
  return records.reduce((sum, record) => sum + record.studySeconds, 0)
}

// The existing demo threshold stays until the backend supplies level thresholds.
export const STUDY_LEVEL_MINUTES = 600
export const MAX_STUDY_LEVEL = 5

export function characterStudySeconds(state: Pick<DemoState, 'records'>, characterId: string) {
  return state.records
    .filter((record) => record.characterIds.includes(characterId))
    .reduce(
      (sum, record) =>
        sum + (Number.isFinite(record.studySeconds)
          ? Math.round(Math.max(0, record.studySeconds) / Math.max(1, record.characterIds.length))
          : 0),
      0,
    )
}

export function studyLevel(state: Pick<DemoState, 'records'>, characterId: string) {
  const minutes = Math.floor(characterStudySeconds(state, characterId) / 60)
  const level = Math.min(MAX_STUDY_LEVEL, 1 + Math.floor(minutes / STUDY_LEVEL_MINUTES))
  return {
    level,
    minutes,
    next: level === MAX_STUDY_LEVEL ? 0 : STUDY_LEVEL_MINUTES - (minutes % STUDY_LEVEL_MINUTES),
    progress: level === MAX_STUDY_LEVEL ? 100 : ((minutes % STUDY_LEVEL_MINUTES) / STUDY_LEVEL_MINUTES) * 100,
  }
}
