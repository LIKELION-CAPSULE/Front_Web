import type { StudyRecord } from '../demo/types.ts'
import { focusDetectedSeconds } from '../session/focus.ts'

/** Graphs and calendar use camera-confirmed time. Missing camera snapshots are not zero measurements. */
export function cameraRecords(records: readonly StudyRecord[]): StudyRecord[] {
  return records.filter(record => record.cameraFocus !== undefined).map(record => ({ ...record, studySeconds: focusDetectedSeconds(record) }))
}
export function connectionSummary(records: readonly StudyRecord[]) {
  const known = records.length > 0
  const allMeasured = known && records.every(record => record.cameraFocus !== undefined)
  return {
    connectionSeconds: known ? records.reduce((sum, record) => sum + record.studySeconds, 0) : null,
    cameraSeconds: allMeasured ? records.reduce((sum, record) => sum + focusDetectedSeconds(record), 0) : null,
    sessions: known ? records.length : null,
    mates: known ? new Set(records.flatMap(record => record.characterIds)).size : null,
  }
}
