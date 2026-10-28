import type { FocusTotals } from '../demo/types.ts'
import { normalizeFocusTotals } from '../session/focus.ts'

export const MAX_FACE_SAMPLE_GAP_MS = 1000
type Anchor = { capturedAt: number; studyMs: number; present: boolean }

/** Integrates elapsed time between fresh frames; model FPS never changes the score. */
export class FaceFocusTracker {
  readonly sessionId: string
  private readonly goalMs: number
  private totals: FocusTotals
  private anchor: Anchor | null = null

  constructor(sessionId: string, goalMs: number, initial?: FocusTotals) {
    this.sessionId = sessionId
    this.goalMs = goalMs
    this.totals = normalizeFocusTotals(initial)
  }
  getTotals() { return { ...this.totals } }
  interrupt() { this.anchor = null }

  private advance(capturedAt: number, studyMs: number) {
    const previous = this.anchor
    if (!previous) return false
    const gap = capturedAt - previous.capturedAt
    const elapsed = studyMs - previous.studyMs
    if (gap <= 0 || gap > MAX_FACE_SAMPLE_GAP_MS || elapsed <= 0 ||
      elapsed > MAX_FACE_SAMPLE_GAP_MS || elapsed > gap + 50) return false
    const duration = Math.min(elapsed, Math.max(0, this.goalMs - this.totals.observedMs))
    this.totals.observedMs += duration
    if (previous.present) this.totals.focusedMs += duration
    return duration > 0
  }
  observe(capturedAt: number, studyMs: number, present: boolean) {
    if (!Number.isFinite(capturedAt) || !Number.isFinite(studyMs) || capturedAt < 0 || studyMs < 0) return
    if (this.anchor && capturedAt <= this.anchor.capturedAt) return
    const bounded = Math.min(studyMs, this.goalMs)
    const measured = this.advance(capturedAt, bounded)
    if (measured && this.anchor && !this.anchor.present && present) this.totals.returns++
    this.anchor = { capturedAt, studyMs: bounded, present }
  }
  close(capturedAt: number, studyMs: number) {
    if (Number.isFinite(capturedAt) && Number.isFinite(studyMs))
      this.advance(capturedAt, Math.min(this.goalMs, Math.max(0, studyMs)))
    this.interrupt()
  }
}
