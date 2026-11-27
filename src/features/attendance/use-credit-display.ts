import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { getCredits } from '@/features/backend/server-api'
import { noteServerCredits, serverCreditsAge, useServerCredits } from '@/features/backend/server-credits'
import { api } from '@/shared/api/client'
import { useCreditReward } from './credit-reward'

/** 33 is read again at most this often (on entry and when the tab shows again); 8 · 16 · 19 · 20 · 28 keep it current between. */
const CREDITS_REFRESH_MS = 60_000

/**
 * The credit balance as every surface should show it (header chip, call screen chip): 「남은 크레딧」 — what can be
 * spent now, attendance part + invitation part (docs/BACKEND_API.md Credits `todayRemaining`). A local preview's
 * isolated wallet comes first (it is what its credits page shows); otherwise the server's summary (server-credits.ts:
 * 8 `/me`, 16, 19, 20 · 28, 33). Rewards earned on this page are added on top and count up when an attendance reward
 * lands. `null` while there is no balance to show.
 */
export function useCreditDisplay() {
  const { wallet, me } = useBackend()
  const server = useServerCredits(me?.userId)
  const { bonus, landing } = useCreditReward()
  const base = wallet ? wallet.attendance + wallet.invitation : server?.todayRemaining ?? null
  const total = base === null ? null : base + bonus
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

  return { value: total === null ? null : counting ?? total, landing }
}

/**
 * Keeps the server balance fresh where the header shows it: 33 `/credits` on entry and when the tab shows again, at most
 * once a minute (a friend's invitation reward or the 5 a.m. reset arrive with no response of ours). Not with a local
 * preview wallet, and not during the service tour (nothing about credits is asked for there).
 */
export function useServerCreditsRefresh() {
  const { status, wallet, me } = useBackend()
  const { search } = useLocation()
  const userId = me?.userId
  const touring = new URLSearchParams(search).has('tour')
  useEffect(() => {
    if (status !== 'ready' || wallet || touring || userId === undefined) return
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
  }, [status, wallet, touring, userId])
}
