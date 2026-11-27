import { applyCheckIn, attendanceFromDays, resolveAttendance, rewardsOf, type AttendanceState, type StoredAttendance } from './attendance-model.ts'
import { CYCLE_DAYS, DAILY_ATTENDANCE_CREDIT } from './attendance-config.ts'
import { attendanceSource, type AttendanceSource } from './attendance-source.ts'
import { checkInAttendance, getAttendance, getCreditTransactions, getCredits } from '../backend/server-api.ts'
import { attendanceGrantFor, noteServerCredits, takeAttendanceGrant } from '../backend/server-credits.ts'
import { creditPage, CreditDataError } from '../credits/credits-data.ts'
import { ApiError, type ApiClient } from '../../shared/api/client.ts'
import type { AttendanceStatusResponse } from '../../shared/api/types.ts'
import { businessDay } from '../../shared/lib/format.ts'

/**
 * The only place that talks to the server about attendance. Two adapters, picked by attendance-source.ts:
 *
 * `credits` — the server as it is (docs/BACKEND_API.md 4.5): no attendance API; the day's 1,500 is granted on the day's
 *   first credit read. Days attended = business days (from 05:00 KST) of 34 `filter=ATTENDANCE` items; today also
 *   counts when a response said `attendanceGrantedNow`. The cycle counts days attended, not days in a row (the mock
 *   rule: missing a day changes nothing, a finished 7-day cycle starts again the next day). Today stays 「not yet」
 *   until the button is pressed: it plays receiving the 1,500 already in the balance (`pendingCredit`), remembered
 *   for the day in this browser. Credits are not read again for it.
 * `attendance-api` — the proposed contract: `GET /attendance`, `POST /attendance/check-in` (201
 *   `{ granted, cycleDay, credits }`; 409 `ALREADY_CHECKED_IN`). The check-in's credit summary refreshes the chips.
 */
type Client = Pick<ApiClient, 'request'>
export type CheckInResult = { state: AttendanceState; credit: number }
type Adapter = {
  fetch: (client: Client, userId: number, today: string) => Promise<AttendanceState>
  checkIn: (client: Client, userId: number, today: string, current: AttendanceState) => Promise<CheckInResult>
}

// ── credits: the server as it is ──

/** 34 pages read for the day count: 50 days each (one attendance a day), so ten pages are 500 days. */
const ATTENDANCE_PAGE_SIZE = 50
const ATTENDANCE_MAX_PAGES = 10
const receivedKey = (userId: number) => `capsule-attendance-received:${userId}`

/** Business days with an attendance grant, newest first, from 34 `filter=ATTENDANCE`. */
export async function attendanceDays(client: Client): Promise<string[]> {
  const days = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < ATTENDANCE_MAX_PAGES; page++) {
    const result = creditPage(await getCreditTransactions(client, { filter: 'ATTENDANCE', cursor, size: ATTENDANCE_PAGE_SIZE }))
    for (const entry of result.entries) if (entry.kind === 'attendance') days.add(businessDay(entry.at))
    if (!result.nextCursor) break
    cursor = result.nextCursor
  }
  return [...days]
}

function readReceived(userId: number): string | null {
  try { return localStorage.getItem(receivedKey(userId)) } catch { return null }
}
function writeReceived(userId: number, today: string) {
  try { localStorage.setItem(receivedKey(userId), today) } catch { /* Shown as received until the page reloads. */ }
}

/** The last days read per account, so a check-in does not read 34 again. */
const lastDays = new Map<number, string[]>()

const creditsAdapter: Adapter = {
  async fetch(client, userId, today) {
    const days = await attendanceDays(client)
    lastDays.set(userId, days)
    const grant = attendanceGrantFor(userId)
    return attendanceFromDays(days, today, { grantedToday: !!grant, received: readReceived(userId) === today, credit: grant?.amount })
  },
  async checkIn(client, userId, today, current) {
    if (current.checkedToday) throw new Error('오늘은 이미 출석했어요.')
    let credit = current.pendingCredit ?? 0
    if (!credit) {
      // Today was never granted (the page stayed open past 05:00): only a credit read grants it (4.5).
      noteServerCredits(await getCredits(client), userId)
      const state = await creditsAdapter.fetch(client, userId, today)
      credit = state.pendingCredit ?? 0
      if (state.checkedToday) return { state, credit: 0 }
      if (!credit) throw new Error('출석을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
    writeReceived(userId, today)
    takeAttendanceGrant(userId)
    const state = attendanceFromDays(lastDays.get(userId) ?? [], today, { grantedToday: true, received: true, credit })
    return { state, credit }
  },
}

// ── attendance-api: the proposed contract ──

/** `GET /attendance` → the cycle. Throws without `checkedToday` and `cycleDay`. */
export function attendanceFromApi(dto: AttendanceStatusResponse | null | undefined): AttendanceState {
  if (!dto || typeof dto.checkedToday !== 'boolean' || typeof dto.cycleDay !== 'number' || !Number.isFinite(dto.cycleDay)) {
    throw new CreditDataError('출석 정보를 확인하지 못했어요.')
  }
  const cycleDay = Math.min(CYCLE_DAYS, Math.max(0, Math.trunc(dto.cycleDay)))
  const credit = typeof dto.rewardPerDay === 'number' && dto.rewardPerDay > 0 ? dto.rewardPerDay : DAILY_ATTENDANCE_CREDIT
  const totalDays = typeof dto.totalDays === 'number' && dto.totalDays >= 0 ? Math.max(cycleDay, Math.trunc(dto.totalDays)) : cycleDay
  return { cycleDay, checkedToday: dto.checkedToday, totalDays, rewards: rewardsOf(credit), pendingCredit: 0 }
}

const apiAdapter: Adapter = {
  fetch: async (client) => attendanceFromApi(await getAttendance(client)),
  async checkIn(client, userId, _today, current) {
    try {
      const result = await checkInAttendance(client)
      noteServerCredits(result.credits, userId)
      const credit = typeof result.granted === 'number' && result.granted > 0 ? result.granted : current.rewards[0]?.credit ?? DAILY_ATTENDANCE_CREDIT
      const cycleDay = typeof result.cycleDay === 'number' ? Math.min(CYCLE_DAYS, Math.max(1, Math.trunc(result.cycleDay))) : Math.min(CYCLE_DAYS, current.cycleDay + 1)
      return { state: { ...current, cycleDay, checkedToday: true, totalDays: current.totalDays + 1, pendingCredit: 0 }, credit }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_CHECKED_IN') throw new Error('오늘은 이미 출석했어요.', { cause: error })
      throw error
    }
  },
}

const ADAPTERS: Record<AttendanceSource, Adapter> = { credits: creditsAdapter, 'attendance-api': apiAdapter }

// ── Development override (AttendanceDevPanel): any point of the cycle, nothing sent ──
const devOverride = new Map<number, StoredAttendance>()

/**
 * `credits` source only: today's 1,500 counts as received without the button — the header has shown the full balance
 * (the home page was left while it held the amount back, or another screen showed it first; use-credit-display.ts).
 * The server granted it on the day's first credit read, so this only stops the home path from holding it back again:
 * coming back home the same day shows today 「받음」. Nothing is sent. The attendance API has its own check-in, so
 * nothing happens there. Returns whether it was recorded.
 */
export function markAttendanceReceived(userId: number, source: AttendanceSource = attendanceSource(), now = Date.now()): boolean {
  if (source !== 'credits' || devOverride.has(userId)) return false
  const today = businessDay(now)
  if (readReceived(userId) === today) return false
  writeReceived(userId, today)
  return true
}

/**
 * Another screen than home shows a balance read today (`creditsAgeMs` ago): it already includes today's grant
 * (granted on the day's first credit read), so the home path must not hold it back later (`markAttendanceReceived`).
 * Not during the service tour, which reads no credits.
 */
export function balanceShownAwayFromHome(pathname: string, touring: boolean, creditsAgeMs: number, now = Date.now()): boolean {
  if (pathname === '/' || touring || !Number.isFinite(creditsAgeMs) || creditsAgeMs < 0) return false
  return businessDay(now - creditsAgeMs) === businessDay(now)
}

export async function fetchAttendance(client: Client, userId: number): Promise<AttendanceState> {
  const today = businessDay()
  const override = devOverride.get(userId)
  if (override) return { ...resolveAttendance(override, today), pendingCredit: 0 }
  return ADAPTERS[attendanceSource()].fetch(client, userId, today)
}

export async function postCheckIn(client: Client, userId: number, current: AttendanceState): Promise<CheckInResult> {
  const today = businessDay()
  const override = devOverride.get(userId)
  if (override) {
    const result = applyCheckIn(override, today)
    devOverride.set(userId, result.stored)
    return { state: { ...result.state, pendingCredit: 0 }, credit: result.reward.credit }
  }
  return ADAPTERS[attendanceSource()].checkIn(client, userId, today, current)
}

/** Development only: jump to any point of the cycle to replay a check-in (the view only; nothing is sent). */
export function setMockAttendance(userId: number, cycleDay: number, checkedToday: boolean) {
  devOverride.set(userId, { cycleDay, lastCheckedOn: checkedToday ? businessDay() : null, totalDays: cycleDay })
}
