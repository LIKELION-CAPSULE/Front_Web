import { useEffect, useState } from 'react'
import { useBackend } from './backend-context'
import { useDemo } from '../demo/demo-context'

export function useServerReport(sessionId?: string) {
  const { state } = useDemo()
  const { loadReport } = useBackend()
  const record = state.records.find(value => value.id === sessionId)
  const [failure, setFailure] = useState<{ id?: string; message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!sessionId || record) return
    let alive = true
    void loadReport(sessionId).catch(reason => {
      if (alive) setFailure({ id: sessionId, message: reason instanceof Error ? reason.message : '리포트를 불러오지 못했어요.' })
    })
    return () => { alive = false }
  }, [sessionId, record, loadReport, attempt])
  return { record, error: failure && failure.id === sessionId ? failure.message : '', retry: () => { setFailure(null); setAttempt(value => value + 1) } }
}
