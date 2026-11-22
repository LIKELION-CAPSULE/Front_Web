import type { DemoState } from '../demo/types.ts'
import type { DemoAction } from '../demo/reducer.ts'
import { normalizeFocusTotals } from '../session/focus.ts'
import { sessionStudySeconds } from '../session/connection-time.ts'

/** Production accepts server patches and camera measurements, never the old local purchase/chat/session simulator. */
export function betaReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'SERVER_SYNC') return { ...state, ...action.patch }
  if (action.type !== 'FACE_FOCUS') return state
  const active = state.activeSession
  if (!active?.serverSession || active.id !== action.sessionId || !Number.isFinite(action.now) || action.now < active.startedAt) return state
  const previous = normalizeFocusTotals(active.focus), next = normalizeFocusTotals(action.totals)
  if (next.observedMs < previous.observedMs || next.focusedMs < previous.focusedMs || next.returns < previous.returns) return state
  const observedMs = Math.min(next.observedMs, Math.max(previous.observedMs, sessionStudySeconds(active, action.now) * 1000))
  const focus = { observedMs, focusedMs: Math.min(observedMs, next.focusedMs), returns: next.returns }
  return previous.observedMs === focus.observedMs && previous.focusedMs === focus.focusedMs && previous.returns === focus.returns ? state : { ...state, activeSession: { ...active, focus } }
}
export type ConnectionReducer = typeof betaReducer
