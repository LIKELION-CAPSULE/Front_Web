import type { ActiveSession } from '../demo/types.ts'

export function sessionElapsed(active: ActiveSession | null, now: number) {
  return active ? Math.max(0, (active.elapsedMs + (active.runningSince === null ? 0 : Math.max(0, now - active.runningSince))) / 1000) : 0
}
/** The published resume contract reports connected study time separately from retired break time. */
export function sessionStudySeconds(active: ActiveSession | null, now: number) {
  return !active ? 0 : active.phase === 'break' ? active.studySeconds : sessionElapsed(active, now)
}
