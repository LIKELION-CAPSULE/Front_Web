import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { EndedConnectionError } from '@/features/backend/ended-connection'
import type { AvailableMate } from './catalog'

/**
 * Starts (or resumes) a connection with a mate and goes to its study room: the same path "다시 연결하기" has
 * always taken. Shared by the connect button, the home hero CTA and the home mate cards.
 */
export function useConnectMate(mate: AvailableMate | null | undefined) {
  const { connectMate } = useBackend()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const connect = useCallback(async () => {
    if (busy || !mate) return
    setBusy(true)
    setError('')
    try {
      // The connection that continued may be another mate's (409 hand-off): go to that mate's call, which shows why.
      const connection = await connectMate(mate.id)
      if (mounted.current) navigate(`/connect/${connection.mateId ?? mate.id}`)
    } catch (reason) {
      if (!mounted.current) return
      if (reason instanceof EndedConnectionError) navigate(`/connections/${reason.connectionId}`, { replace: true })
      else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [busy, mate, connectMate, navigate])

  return { connect, busy, error }
}
