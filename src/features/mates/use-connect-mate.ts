import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { EndedConnectionError } from '@/features/backend/ended-connection'
import { availableMates, connectBlockedMessage, type AvailableMate } from './catalog'
import { playPickup } from './pickup-sequence'

/**
 * Starts (or resumes) a connection with a mate and goes to its study room: the same path "다시 연결하기" has
 * always taken. Shared by the connect button, the home hero CTA and the home mate cards.
 *
 * `{ pickup: true }` plays the "picking up the phone" sequence (pickup-sequence.ts) alongside the request and moves
 * on once both are done; the call page then switches its screen on. A failed request removes it at once.
 */
export function useConnectMate(mate: AvailableMate | null | undefined) {
  const { connectMate, home } = useBackend()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const connect = useCallback(async (options: { pickup?: boolean } = {}) => {
    if (busy || !mate) return
    // A coming-soon mate cannot be connected (16 answers 409 MATE_COMING_SOON): its page offers the alert instead.
    // Said, not silently ignored (the same words as the server's refusal).
    const blocked = connectBlockedMessage(mate)
    if (blocked) { setError(blocked); return }
    setBusy(true)
    setError('')
    const pickup = options.pickup ? playPickup({ name: mate.name, reduced: prefersReducedMotion() }) : null
    try {
      // The connection that continued may be another mate's (409 hand-off): the pickup names that mate, and the
      // call that opens once it has played is that mate's, which says why.
      const connection = await connectMate(mate.id)
      // Never the mate asked for in its place: a continued connection with a mate the app cannot show stays where it
      // is, with a message (the call screen of the mate asked for would not be that connection's).
      const target = connection.mateId
      if (!target) {
        pickup?.cancel()
        if (mounted.current) setError('다른 곳에서 진행 중인 연결이 있어요. 그 연결을 먼저 마쳐 주세요.')
        return
      }
      if (pickup && target !== mate.id) {
        const actual = availableMates(home).find(value => value.id === target)
        if (actual) pickup.rename(actual.name)
      }
      if (pickup && !(await pickup.finished)) return
      if (mounted.current) navigate(`/connect/${target}`)
      else pickup?.cancel()
    } catch (reason) {
      pickup?.cancel()
      if (!mounted.current) return
      if (reason instanceof EndedConnectionError) navigate(`/connections/${reason.connectionId}`, { replace: true })
      else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [busy, mate, connectMate, home, navigate])

  return { connect, busy, error }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
