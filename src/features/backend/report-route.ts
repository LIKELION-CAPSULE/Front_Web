/** A report exists only after settlement; an authenticated return URL can still point at an ongoing or missing study. */
export function reportDestination({ sessionId, hasRecord, activeSessionId, summarySessionId, missing }: {
  sessionId?: string
  hasRecord: boolean
  activeSessionId?: string
  summarySessionId?: number
  missing: boolean
}): string | null {
  if (hasRecord || !sessionId) return null
  if (activeSessionId === sessionId) return `/study/${sessionId}`
  if (summarySessionId !== undefined && String(summarySessionId) === sessionId) return `/study/${sessionId}?resume=1`
  return missing ? '/' : null
}
