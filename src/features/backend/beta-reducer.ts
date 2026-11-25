import type { DemoState, FocusTotals } from '../demo/types.ts'
import { normalizeFocusTotals } from '../session/focus.ts'
import { sessionStudySeconds } from '../session/connection-time.ts'

/** What the app state accepts: server patches and camera measurements (the old local session simulator is gone). */
export type ConnectionAction =
  | { type: 'SERVER_SYNC'; patch: Partial<DemoState> }
  | { type: 'FACE_FOCUS'; sessionId: string; totals: FocusTotals; now: number }

export function betaReducer(state: DemoState, action: ConnectionAction): DemoState {
  if (action.type === 'SERVER_SYNC') return { ...state, ...action.patch }
  const active = state.activeSession
  if (!active?.serverSession || active.id !== action.sessionId || !Number.isFinite(action.now) || action.now < active.startedAt) return state
  const previous = normalizeFocusTotals(active.focus), next = normalizeFocusTotals(action.totals)
  if (next.observedMs < previous.observedMs || next.focusedMs < previous.focusedMs || next.returns < previous.returns) return state
  const observedMs = Math.min(next.observedMs, Math.max(previous.observedMs, sessionStudySeconds(active, action.now) * 1000))
  const focus = { observedMs, focusedMs: Math.min(observedMs, next.focusedMs), returns: next.returns }
  return previous.observedMs === focus.observedMs && previous.focusedMs === focus.focusedMs && previous.returns === focus.returns ? state : { ...state, activeSession: { ...active, focus } }
}
