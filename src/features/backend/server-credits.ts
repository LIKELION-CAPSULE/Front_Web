import { useSyncExternalStore } from 'react'
import type { Credits } from '@/shared/api/types'
import { businessDay } from '../../shared/lib/format.ts'

/**
 * The last credit summary the server sent for the signed-in account (docs/BACKEND_API.md Credits): 8 `/me`, 16 start,
 * 19 reaction (with `tts`), 20 · 28 message and 33 `/credits` all carry it. The header and call screen chips read
 * `todayRemaining` from here — 「지금 쓸 수 있는 양 = 출석분 + 초대분」, the whole balance, so they say 「남은 크레딧」
 * (not 「오늘 남은」: the invitation part never expires).
 *
 * One account at a time: an update with a user id starts (or replaces) that account's entry; one without (a response
 * inside the running connection) only refreshes the current account's. Sign-out clears it.
 *
 * Attendance (4.5): there is no attendance API. The server grants the day's 1,500 the first time the day's credits are
 * read or spent (8 · 16 · 33 · 34 · a charge) and says so once with `attendanceGrantedNow`. That flag is kept here as
 * the account's 「출석 지급」 until the home attendance path plays it (`takeAttendanceGrant`).
 */
type Entry = { userId: number; credits: Credits; at: number }
/** Today's attendance credits, granted by the server and not yet shown on the home path. */
export type AttendanceGrant = { id: number; userId: number; amount: number; day: string }

/** The daily attendance amount (4.5), when a grant comes without `attendanceRemaining`. */
const DAILY_ATTENDANCE = 1500

let entry: Entry | null = null
let grant: AttendanceGrant | null = null
let grantSequence = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

const usable = (credits: Credits | null | undefined): credits is Credits & { todayRemaining: number } =>
  !!credits && typeof credits.todayRemaining === 'number' && Number.isFinite(credits.todayRemaining)

/** Keeps `credits` as the account's latest summary. Ignored without a usable `todayRemaining`. */
export function noteServerCredits(credits: Credits | null | undefined, userId?: number) {
  if (!usable(credits)) return
  const owner = userId ?? entry?.userId
  if (owner === undefined || (userId === undefined && !entry)) return
  // The grant flag belongs to the response that carried it, not to the kept summary.
  const { attendanceGrantedNow, ...summary } = credits
  entry = { userId: owner, credits: { ...(entry?.userId === owner ? entry.credits : {}), ...summary }, at: Date.now() }
  if (attendanceGrantedNow === true) {
    const amount = typeof summary.attendanceRemaining === 'number' && summary.attendanceRemaining > 0 ? summary.attendanceRemaining : DAILY_ATTENDANCE
    grant = { id: ++grantSequence, userId: owner, amount: Math.min(amount, DAILY_ATTENDANCE), day: businessDay() }
  } else if (grant && grant.userId !== owner) grant = null
  emit()
}

export function clearServerCredits() {
  if (!entry && !grant) return
  entry = null
  grant = null
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

/** Today's grant for this account that the home path has not played yet (null: none, another account's, or a past day's). */
export function attendanceGrantFor(userId: number | undefined, now = Date.now()): AttendanceGrant | null {
  return grant && userId !== undefined && grant.userId === userId && grant.day === businessDay(now) ? grant : null
}

/** The home path plays the grant: it is handed over once. */
export function takeAttendanceGrant(userId: number | undefined, now = Date.now()): AttendanceGrant | null {
  const current = attendanceGrantFor(userId, now)
  if (!current) return null
  grant = null
  emit()
  return current
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

/** The account's grant waiting to be played (see `attendanceGrantFor`). */
export function useAttendanceGrant(userId: number | undefined): AttendanceGrant | null {
  const current = useSyncExternalStore(subscribe, () => grant, () => null)
  return current && attendanceGrantFor(userId) === current ? current : null
}
