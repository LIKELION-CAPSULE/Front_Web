import type { FocusTotals, StudyRecord } from '../demo/types.ts'

const nonnegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, value) : 0

export function normalizeFocusTotals(value: FocusTotals | undefined): FocusTotals {
  const observedMs = nonnegative(value?.observedMs)
  return {
    observedMs,
    focusedMs: Math.min(observedMs, nonnegative(value?.focusedMs)),
    returns: Math.floor(nonnegative(value?.returns)),
  }
}

export function focusPercent(focused: number, observed: number): number | null {
  return observed > 0 ? Math.round(Math.max(0, Math.min(1, focused / observed)) * 1000) / 10 : null
}

/** Legacy samples already partition their entire study time into focus/away. */
export function focusMeasuredSeconds(record: StudyRecord) {
  return record.observedSeconds === undefined ? record.studySeconds
    : Math.min(nonnegative(record.studySeconds), nonnegative(record.observedSeconds))
}

export function recordFocusPercent(record: StudyRecord) {
  return focusPercent(record.focusSeconds, focusMeasuredSeconds(record))
}
