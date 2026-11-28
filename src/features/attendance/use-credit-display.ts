import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { getCredits } from '@/features/backend/server-api'
import { noteServerCredits, serverCreditsAge, useServerCredits } from '@/features/backend/server-credits'
import { api } from '@/shared/api/client'
import { useCreditReward } from './credit-reward'
import { balanceShownAwayFromHome, markAttendanceReceived } from './attendance-service'

/** 33 is read again at most this often (on entry and when the tab shows again); 8 · 16 · 19 · 20 · 28 keep it current between. */
const CREDITS_REFRESH_MS = 60_000

/**
 * The credit balance as every surface should show it (header chip, call screen chip, 내 크레딧): 「남은 크레딧」 — what
 * can be spent now, attendance part + invitation part (docs/BACKEND_API.md Credits `todayRemaining`), always the
 * server's summary (server-credits.ts: 8 `/me`, 16, 19, 20 · 28, 33; the local mock answers the same paths). Today's
 * attendance grant is held back while the home path is about to play it, and counts up when it lands
 * (credit-reward.ts). `null` while there is no balance to show. Shown on another screen first, that grant counts as
 * received, so the home page does not take it back out of the chip later (attendance-service.ts). `pending` while the
 * home page still reads whether to hold it back (the number is not known yet; the chip waits rather than dropping).
 */
export function useCreditDisplay() {
  const { me } = useBackend()
  const userId = me?.userId
  const server = useServerCredits(userId)
  const { pathname, search } = useLocation()
  const touring = new URLSearchParams(search).has('tour')
  const shown = typeof server?.todayRemaining === 'number'
  useEffect(() => {
    if (userId === undefined || !shown) return
    if (balanceShownAwayFromHome(pathname, touring, serverCreditsAge(userId))) markAttendanceReceived(userId)
  }, [userId, shown, pathname, touring, server])
  const { held, landing, pending } = useCreditReward()
  const base = server?.todayRemaining ?? null
  const total = base === null ? null : Math.max(0, base - held)
  const [counting, setCounting] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const landed = useRef(landing?.id)

  useEffect(() => {
    if (!landing || landing.id === landed.current || total === null) return
    landed.current = landing.id
    if (reduced) return
    const count = animate(total - landing.amount, total, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (value) => setCounting(Math.round(value)),
      onComplete: () => setCounting(null),
    })
    return () => {
      count.stop()
      setCounting(null)
    }
  }, [total, landing, reduced])

  // `pending`: the home page has not read yet whether today's grant is held back; the chip shows a placeholder.
  return { value: total === null ? null : counting ?? total, landing, pending: pending && total !== null }
}

/**
 * Keeps the server balance fresh where the header shows it: 33 `/credits` on entry and when the tab shows again, at most
 * once a minute (a friend's invitation reward or the 5 a.m. reset arrive with no response of ours). Not during the
 * service tour (nothing about credits is asked for there).
 */
export function useServerCreditsRefresh() {
  const { status, me } = useBackend()
  const { search } = useLocation()
  const userId = me?.userId
  const touring = new URLSearchParams(search).has('tour')
  useEffect(() => {
    if (status !== 'ready' || touring || userId === undefined) return
    let alive = true
    const refresh = () => {
      if (document.visibilityState !== 'visible' || serverCreditsAge(userId) < CREDITS_REFRESH_MS) return
      getCredits(api)
        .then((credits) => { if (alive) noteServerCredits(credits, userId) })
        .catch(() => { /* Keep the last balance; the next chance tries again. */ })
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [status, touring, userId])
}
