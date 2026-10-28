import type { StudyRecord } from '../demo/types.ts'
import { characterStudySeconds, MAX_RELATIONSHIP_LEVEL, RELATIONSHIP_LEVEL_MINUTES } from '../demo/selectors.ts'

const stepSeconds = RELATIONSHIP_LEVEL_MINUTES * 60
function atSeconds(seconds: number) {
  const level = Math.min(MAX_RELATIONSHIP_LEVEL, 1 + Math.floor(seconds / stepSeconds))
  return {
    level,
    progress: level === MAX_RELATIONSHIP_LEVEL ? 100 : (seconds % stepSeconds) / stepSeconds * 100,
    next: level === MAX_RELATIONSHIP_LEVEL ? 0 : Math.ceil((stepSeconds - seconds % stepSeconds) / 60),
  }
}

export function reportRelationship(records: readonly StudyRecord[], record: StudyRecord, characterId: string) {
  const prior = records.filter(item => item.id !== record.id && (
    item.endedAt < record.endedAt || (item.endedAt === record.endedAt && (
      item.startedAt < record.startedAt || (item.startedAt === record.startedAt && item.id < record.id)
    ))
  ))
  const beforeSeconds = characterStudySeconds({ records: prior }, characterId)
  const gainSeconds = characterStudySeconds({ records: [record] }, characterId)
  const afterSeconds = beforeSeconds + gainSeconds
  const before = atSeconds(beforeSeconds), after = atSeconds(afterSeconds)
  const steps: { level: number; from: number; to: number; nextLevel?: number }[] = []
  let cursor = beforeSeconds
  while (cursor < afterSeconds && atSeconds(cursor).level < MAX_RELATIONSHIP_LEVEL) {
    const current = atSeconds(cursor)
    const boundary = current.level * stepSeconds
    const end = Math.min(afterSeconds, boundary)
    steps.push({ level: current.level, from: current.progress, to: (end - (current.level - 1) * stepSeconds) / stepSeconds * 100, nextLevel: end === boundary ? current.level + 1 : undefined })
    cursor = end
  }
  return { before, after, gainSeconds, steps }
}

export type ReportRelationship = ReturnType<typeof reportRelationship>
