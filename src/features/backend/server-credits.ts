import { useSyncExternalStore } from 'react'
import type { Credits } from '@/shared/api/types'

/**
 * The last credit summary the server sent for the signed-in account (docs/BACKEND_API.md Credits): 8 `/me`, 16 start,
 * 19 reaction (with `tts`), 20 · 28 message and 33 `/credits` all carry it. The header and call screen chips read
 * `todayRemaining` from here — 「지금 쓸 수 있는 양 = 출석분 + 초대분」, the whole balance, so they say 「남은 크레딧」
 * (not 「오늘 남은」: the invitation part never expires).
 *
 * One account at a time: an update with a user id starts (or replaces) that account's entry; one without (a response
 * inside the running connection) only refreshes the current account's. Sign-out clears it.
 */
type Entry = { userId: number; credits: Credits; at: number }

let entry: Entry | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

const usable = (credits: Credits | null | undefined): credits is Credits & { todayRemaining: number } =>
  !!credits && typeof credits.todayRemaining === 'number' && Number.isFinite(credits.todayRemaining)

/** Keeps `credits` as the account's latest summary. Ignored without a usable `todayRemaining`. */
export function noteServerCredits(credits: Credits | null | undefined, userId?: number) {
  if (!usable(credits)) return
  const owner = userId ?? entry?.userId
  if (owner === undefined || (userId === undefined && !entry)) return
  entry = { userId: owner, credits: { ...(entry?.userId === owner ? entry.credits : {}), ...credits }, at: Date.now() }
  emit()
}

export function clearServerCredits() {
  if (!entry) return
  entry = null
  emit()
}

/** How long ago this account's summary arrived (Infinity: never), for callers that refresh it now and then. */
export function serverCreditsAge(userId: number | undefined, now = Date.now()) {
  return entry && entry.userId === userId ? now - entry.at : Number.POSITIVE_INFINITY
}

/** The account's latest summary outside React (null: none yet, or another account's). */
export function serverCreditsFor(userId: number | undefined): Credits | null {
  return entry && userId !== undefined && entry.userId === userId ? entry.credits : null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The signed-in account's latest server credit summary, or null before one arrives (or for another account). */
export function useServerCredits(userId: number | undefined): Credits | null {
  const current = useSyncExternalStore(subscribe, () => entry, () => null)
  return current && userId !== undefined && current.userId === userId ? current.credits : null
}
