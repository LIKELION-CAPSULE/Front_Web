import type { StudyRecord } from '../demo/types.ts'
import { duration, measuredDuration } from '../../shared/lib/format.ts'

export const capsuleCardCopy = {
  quote: '다음에도 같이 공부하자.',
  badge: '함께 쌓은 집중',
} as const

export function capsuleFocusCopy(record: Pick<StudyRecord, 'observedSeconds' | 'focusSeconds' | 'returns'>) {
  const format = record.observedSeconds === undefined ? duration : measuredDuration
  const focus = record.observedSeconds === 0 ? '집중 측정 대기' : `집중 ${format(record.focusSeconds)}`
  return `${focus} · 복귀 ${record.returns}회`
}
