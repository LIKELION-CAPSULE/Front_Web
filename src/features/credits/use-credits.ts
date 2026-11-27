import { useCallback, useEffect, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { getCreditTransactions, getCredits, getMyReferral } from '@/features/backend/server-api'
import { noteServerCredits } from '@/features/backend/server-credits'
import { api } from '@/shared/api/client'
import type { CreditTransactionFilter } from '@/shared/api/types'
import { appendCreditPage, creditPage, creditSummary, referralView, type CreditEntry, type CreditSummary, type ReferralView } from './credits-data'

/**
 * 내 크레딧 and 친구 초대 read the server: 33 (summary), 34 (activity, a cursor page at a time) and 35 (invitation).
 * The local mock answers the same paths in the same shapes. Each read starts when the account is ready and again on
 * 「다시 시도」; a result is only used for the request it answers (`key`), so a late answer never overwrites a newer one.
 */
export type Loadable<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }

const PAGE_SIZE = 20
const message = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback

function useAccount() {
  const { status, me } = useBackend()
  return { ready: status === 'ready' && me?.userId !== undefined, userId: me?.userId }
}

/** [33] The summary card. Also refreshes the header chip's balance (server-credits.ts). */
export function useCreditSummary() {
  const { ready, userId } = useAccount()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Loadable<CreditSummary> } | null>(null)
  const key = `${userId}:${attempt}`
  useEffect(() => {
    if (!ready) return
    let alive = true
    getCredits(api)
      .then(dto => {
        if (!alive) return
        noteServerCredits(dto, userId)
        setResult({ key, value: { status: 'ready', data: creditSummary(dto) } })
      })
      .catch(error => { if (alive) setResult({ key, value: { status: 'error', error: message(error, '크레딧 정보를 불러오지 못했어요.') } }) })
    return () => { alive = false }
  }, [ready, key, userId])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const value: Loadable<CreditSummary> = result?.key === key ? result.value : { status: 'loading' }
  return { ...value, retry } as Loadable<CreditSummary> & { retry: () => void }
}

type ActivityState = { key: string; entries: CreditEntry[]; nextCursor: string | null; error: string | null; more: 'idle' | 'loading' | 'error' }

/** [34] The activity list for one filter: the first page, then 「더 보기」 for the next cursor. */
export function useCreditActivity(filter: CreditTransactionFilter) {
  const { ready } = useAccount()
  const [attempt, setAttempt] = useState(0)
  const [list, setList] = useState<ActivityState | null>(null)
  const key = `${filter}:${attempt}`
  useEffect(() => {
    if (!ready) return
    let alive = true
    getCreditTransactions(api, { filter, size: PAGE_SIZE })
      .then(dto => {
        if (!alive) return
        const page = creditPage(dto)
        setList({ key, entries: page.entries, nextCursor: page.nextCursor, error: null, more: 'idle' })
      })
      .catch(error => { if (alive) setList({ key, entries: [], nextCursor: null, error: message(error, '크레딧 내역을 불러오지 못했어요.'), more: 'idle' }) })
    return () => { alive = false }
  }, [ready, key, filter])
  const current = list?.key === key ? list : null
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const loadMore = useCallback(async () => {
    if (!current?.nextCursor || current.more === 'loading') return
    const cursor = current.nextCursor
    const update = (change: (previous: ActivityState) => ActivityState) => setList(previous => previous && previous.key === key ? change(previous) : previous)
    update(previous => ({ ...previous, more: 'loading' }))
    try {
      const page = creditPage(await getCreditTransactions(api, { filter, cursor, size: PAGE_SIZE }))
      update(previous => ({ ...previous, entries: appendCreditPage(previous.entries, page), nextCursor: page.nextCursor, more: 'idle' }))
    } catch {
      update(previous => ({ ...previous, more: 'error' }))
    }
  }, [current, key, filter])
  return {
    status: !current ? 'loading' as const : current.error ? 'error' as const : 'ready' as const,
    error: current?.error ?? null,
    entries: current?.entries ?? [],
    hasMore: !!current?.nextCursor,
    more: current?.more ?? 'idle',
    retry,
    loadMore,
  }
}

/** [35] The invitation: my code and link, the rewards, the friends, whether a received code can still be entered. */
export function useReferralStatus() {
  const { ready, userId } = useAccount()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Loadable<ReferralView> } | null>(null)
  const key = `${userId}:${attempt}`
  useEffect(() => {
    if (!ready) return
    let alive = true
    getMyReferral(api)
      .then(dto => { if (alive) setResult({ key, value: { status: 'ready', data: referralView(dto) } }) })
      .catch(error => { if (alive) setResult({ key, value: { status: 'error', error: message(error, '초대 정보를 불러오지 못했어요.') } }) })
    return () => { alive = false }
  }, [ready, key])
  /** Reads 35 again; the last value stays on screen meanwhile (after entering a code). */
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  const value: Loadable<ReferralView> = result?.key === key ? result.value
    : result && result.key.startsWith(`${userId}:`) && attempt > 0 && result.value.status === 'ready' ? result.value : { status: 'loading' }
  return { ...value, reload } as Loadable<ReferralView> & { reload: () => void }
}
