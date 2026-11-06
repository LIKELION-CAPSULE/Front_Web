export type StudyRoute = 'active' | 'finishing' | 'report' | 'resume' | 'missing'

/** Settlement can clear the session before the report route finishes loading. */
export function resolveStudyRoute({ sessionId, activeSessionId, summarySessionId, completedSessionIds, finishing }: {
  sessionId?: string
  activeSessionId?: string
  summarySessionId?: number
  completedSessionIds: readonly string[]
  finishing: boolean
}): StudyRoute {
  if (sessionId && activeSessionId === sessionId) return 'active'
  if (sessionId && completedSessionIds.includes(sessionId)) return 'report'
  if (finishing) return 'finishing'
  if (sessionId && summarySessionId !== undefined && String(summarySessionId) === sessionId) return 'resume'
  return 'missing'
}
