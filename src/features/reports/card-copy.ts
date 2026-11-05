import type { StudyRecord } from '../demo/types.ts'
import { duration, measuredDuration } from '../../shared/lib/format.ts'
import { normalizeFocusTotals } from '../session/focus.ts'

export const capsuleCardCopy = {
  quote: '다음에도 같이 공부하자.',
  badge: '함께 쌓은 집중',
} as const

export function capsuleFocusCopy(record: Pick<StudyRecord, 'observedSeconds' | 'focusSeconds' | 'returns' | 'serverReport' | 'cameraFocus'>) {
  const format = record.observedSeconds === undefined ? duration : measuredDuration
  if (record.serverReport) {
    const camera = normalizeFocusTotals(record.cameraFocus)
    const focus = camera.observedMs > 0 ? `집중 ${measuredDuration(camera.focusedMs / 1000)}` : '집중 측정 대기'
    return `${focus} · 복귀 ${camera.returns}회`
  }
  const focus = record.observedSeconds === 0 ? '집중 측정 대기' : `집중 ${format(record.focusSeconds)}`
  return `${focus} · 복귀 ${record.returns}회`
}
