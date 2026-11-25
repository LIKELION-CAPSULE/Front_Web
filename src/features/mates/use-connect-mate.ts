import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { EndedConnectionError } from '@/features/backend/ended-connection'
import { useDemo } from '@/features/demo/demo-context'
import type { ActiveSession } from '@/features/demo/types'
import { availableMates, connectBlockedMessage, type AvailableMate } from './catalog'
import { showPickupCancel } from './pickup-cancel'
import { playPickup } from './pickup-sequence'

/**
 * Starts (or resumes) a connection with a mate and goes to its study room: the same path "다시 연결하기" has
 * always taken. Shared by the connect button, the home hero CTA and the home mate cards.
 *
 * `{ pickup: true }` plays the "picking up the phone" sequence (pickup-sequence.ts) alongside the request and moves
 * on once both are done; the call page then switches its screen on. A failed request removes it at once.
 *
 * While it plays, 「취소」 or Escape (pickup-cancel.ts) stops it and stays on this screen (UX review 2-1). The request has
 * usually been answered by then, so the server state decides the rest:
 * - a connection this click started (none running before, a fresh start — not a 17 resume, not a 409 hand-off to a
 *   connection already running elsewhere) is ended right away (22 `/end`). Left open, it would be invisible on home
 *   (no resume entry there) yet block every other mate (「…와 연결 중이에요」) until the server timed it out;
 * - a connection that was already running (this tab, another tab or device) is left as it was: cancelling the ring
 *   must not end a real call.
 */
export function useConnectMate(mate: AvailableMate | null | undefined) {
  const { connectMate, finishSession, home, activeSummary } = useBackend()
  const { state } = useDemo()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // After a cancel, the focus goes back to the control that started it, once it is enabled again.
  const focusBack = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const target = focusBack.current
    if (busy || !target) return
    focusBack.current = null
    if (target.isConnected) target.focus({ preventScroll: true })
  }, [busy])

  const connect = useCallback(async (options: { pickup?: boolean } = {}) => {
    if (busy || !mate) return
    // A coming-soon mate cannot be connected (16 answers 409 MATE_COMING_SOON): its page offers the alert instead.
    // Said, not silently ignored (the same words as the server's refusal).
    const blocked = connectBlockedMessage(mate)
    if (blocked) { setError(blocked); return }
    setBusy(true)
    setError('')
    // Whether a connection was running before this click (this tab's, or one the server reported): a cancel never
    // ends that one.
    const runningBefore = Boolean(state.activeSession || activeSummary)
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const pickup = options.pickup ? playPickup({ name: mate.name, reduced: prefersReducedMotion() }) : null
    let cancelled = false
    const cancelControl = pickup ? showPickupCancel(() => { cancelled = true; pickup.cancel() }) : null
    /** After a cancel: end the connection only if this click started it (see the note above). */
    const settleCancelled = async (connection: ActiveSession) => {
      if (runningBefore || connection.initialTotals !== undefined) return
      try {
        // The call screen never opened, so nothing was measured: zero totals (connected time included — the user was
        // never on the call).
        await finishSession({ totals: { connectedSeconds: 0, presentSeconds: 0, cameraOnSeconds: 0, pipSeconds: 0 } })
      } catch {
        if (mounted.current) setError('연결을 취소했지만 정리하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    }
    try {
      // The connection that continued may be another mate's (409 hand-off): the pickup names that mate, and the
      // call that opens once it has played is that mate's, which says why.
      const connection = await connectMate(mate.id)
      if (cancelled) { await settleCancelled(connection); return }
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
      if (pickup && !(await pickup.finished)) {
        if (cancelled) await settleCancelled(connection)
        return
      }
      // Past the ring: from here the call page takes the sequence over, so there is nothing left to cancel.
      cancelControl?.remove()
      if (mounted.current) navigate(`/connect/${target}`)
      else pickup?.cancel()
    } catch (reason) {
      pickup?.cancel()
      // Cancelled before the server answered and the request failed: nothing was started, nothing to say.
      if (cancelled || !mounted.current) return
      if (reason instanceof EndedConnectionError) navigate(`/connections/${reason.connectionId}`, { replace: true })
      else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    } finally {
      cancelControl?.remove()
      if (cancelled) focusBack.current = trigger
      if (mounted.current) setBusy(false)
    }
  }, [busy, mate, connectMate, finishSession, home, navigate, state.activeSession, activeSummary])

  return { connect, busy, error }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
