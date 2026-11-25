import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { ActiveSession, FocusTotals } from '../demo/types'
import { sessionStudySeconds } from '../session/connection-time'
import type { ConnectionAction } from '../backend/beta-reducer'
import { normalizeFocusTotals } from '../session/focus'
import { FaceFocusTracker, MAX_FACE_SAMPLE_GAP_MS } from './face-focus-tracker'
import type { Observation } from './types'
import { isConnectionVisible } from '@/features/mates/document-pip'

export function useFaceFocus({ session, enabled, observation, dispatch }: {
  session: ActiveSession | null
  enabled: boolean
  observation: Observation | null
  dispatch: Dispatch<ConnectionAction>
}) {
  const trackerRef = useRef<FaceFocusTracker | null>(null)
  const published = useRef<FocusTotals | null>(null)
  const publish = useCallback(() => {
    const tracker = trackerRef.current
    if (!tracker) return
    const totals = tracker.getTotals()
    const last = published.current
    if (last && last.observedMs === totals.observedMs && last.focusedMs === totals.focusedMs && last.returns === totals.returns) return
    published.current = totals
    dispatch({ type: 'FACE_FOCUS', sessionId: tracker.sessionId, totals, now: Date.now() })
  }, [dispatch])

  useLayoutEffect(() => {
    if (!session) { trackerRef.current = null; published.current = null; return }
    if (trackerRef.current?.sessionId !== session.id) {
      const initial = normalizeFocusTotals(session.focus)
      // Measure all actual study time, including overtime; the session helper excludes rests.
      trackerRef.current = new FaceFocusTracker(session.id, Number.POSITIVE_INFINITY, initial)
      published.current = initial
    }
    const tracker = trackerRef.current
    if (!enabled || !observation || !isConnectionVisible()) {
      if (session.phase === 'break') tracker.close(performance.now(), session.studySeconds * 1000)
      else tracker.interrupt()
      publish()
      return
    }
    const epoch = performance.timeOrigin + observation.at
    if (performance.now() - observation.at > MAX_FACE_SAMPLE_GAP_MS || epoch < session.startedAt) {
      tracker.interrupt()
      return
    }
    tracker.observe(observation.at, sessionStudySeconds(session, epoch) * 1000, observation.faceCount > 0)
  }, [session, enabled, observation, publish])

  useEffect(() => {
    const interval = window.setInterval(publish, 1000)
    const hidden = () => {
      if (!isConnectionVisible()) { trackerRef.current?.interrupt(); publish() }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', hidden) }
  }, [publish])

  return useCallback(() => {
    if (session && enabled && isConnectionVisible() && trackerRef.current?.sessionId === session.id)
      trackerRef.current.close(performance.now(), sessionStudySeconds(session, Date.now()) * 1000)
    publish()
  }, [session, enabled, publish])
}
