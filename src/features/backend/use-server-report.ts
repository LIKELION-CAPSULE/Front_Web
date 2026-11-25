import { useEffect, useState } from 'react'
import { useBackend } from './backend-context'
import { useDemo } from '../demo/demo-context'
import { ApiError } from '@/shared/api/client'
import { reportDestination } from './report-route'

export function useServerReport(sessionId?: string) {
  const { state } = useDemo()
  const { loadReport, activeSummary } = useBackend()
  const record = state.records.find(value => value.id === sessionId)
  const [failure, setFailure] = useState<{ id?: string; message: string; status?: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const error = !record && failure?.id === sessionId ? failure : null
  const redirectTo = reportDestination({ sessionId, hasRecord: !!record, activeSessionId: state.activeSession?.id,
    summarySessionId: activeSummary?.connectionId, missing: error?.status === 404 })
  useEffect(() => {
    if (!sessionId || record || redirectTo) return
    let alive = true
    void loadReport(sessionId).catch(reason => {
      if (alive) setFailure({ id: sessionId, message: reason instanceof Error ? reason.message : '연결 기록을 불러오지 못했어요.', status: reason instanceof ApiError ? reason.status : undefined })
    })
    return () => { alive = false }
  }, [sessionId, record, loadReport, attempt, redirectTo])
  return { record, error: error?.message ?? '', redirectTo, retry: () => { setFailure(null); setAttempt(value => value + 1) } }
}
