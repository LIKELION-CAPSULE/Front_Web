import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { ActiveSession, FocusTotals } from '../demo/types'
import { sessionElapsed, type DemoAction } from '../demo/reducer'
import { studyGoalSeconds } from '../session/study-goal'
import { normalizeFocusTotals } from '../session/focus'
import { FaceFocusTracker, MAX_FACE_SAMPLE_GAP_MS } from './face-focus-tracker'
import type { Observation } from './types'

export function useFaceFocus({ session, enabled, observation, dispatch }: {
  session: ActiveSession | null
  enabled: boolean
  observation: Observation | null
  dispatch: Dispatch<DemoAction>
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
      trackerRef.current = new FaceFocusTracker(session.id, studyGoalSeconds(session) * 1000, initial)
      published.current = initial
    }
    const tracker = trackerRef.current
    if (!enabled || !observation || document.hidden) {
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
    tracker.observe(observation.at, sessionElapsed(session, epoch) * 1000, observation.faceCount > 0)
  }, [session, enabled, observation, publish])

  useEffect(() => {
    const interval = window.setInterval(publish, 1000)
    const hidden = () => {
      if (document.hidden) { trackerRef.current?.interrupt(); publish() }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', hidden) }
  }, [publish])

  return useCallback(() => {
    if (session && enabled && !document.hidden && trackerRef.current?.sessionId === session.id)
      trackerRef.current.close(performance.now(), sessionElapsed(session, Date.now()) * 1000)
    publish()
  }, [session, enabled, publish])
}
