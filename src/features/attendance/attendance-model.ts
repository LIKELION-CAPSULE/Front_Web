import { type AttendanceCounting, ATTENDANCE_COUNTING, CYCLE_DAYS, DAILY_ATTENDANCE_CREDIT, DEFAULT_REWARDS } from './attendance-config.ts'

export type AttendanceReward = { day: number; credit: number; milestone: boolean }
export type AttendanceState = {
  /** Days completed in this cycle, 0–6. */
  cycleDay: number
  checkedToday: boolean
  /** Every day ever checked in, across cycles. */
  totalDays: number
  rewards: AttendanceReward[]
  /**
   * Credits the server already granted today that the button has not shown yet (attendance-service.ts, `credits`
   * source): the header chip holds them back on the home page until they land. 0 or absent otherwise.
   */
  pendingCredit?: number
}

/** The cycle as last checked in. Missing a day changes nothing: progress simply waits (days attended, not in a row). */
export type StoredAttendance = { cycleDay: number; lastCheckedOn: string | null; totalDays?: number }

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function defaultRewards(): AttendanceReward[] {
  return DEFAULT_REWARDS.map((reward) => ({ ...reward }))
}

/** The state to show today. A finished cycle starts over at day 1 the next day it is opened. */
export function resolveAttendance(stored: StoredAttendance, today: string, rewards = defaultRewards()): AttendanceState {
  const checkedToday = stored.lastCheckedOn === today
  const cycleDay = Math.min(CYCLE_DAYS, Math.max(0, Math.trunc(stored.cycleDay) || 0))
  const totalDays = Math.max(cycleDay, Math.trunc(stored.totalDays ?? 0) || 0)
  return { cycleDay: cycleDay >= CYCLE_DAYS && !checkedToday ? 0 : cycleDay, checkedToday, totalDays, rewards }
}

/** Records today's check-in; throws when there is nothing to check in. */
export function applyCheckIn(stored: StoredAttendance, today: string, rewards = defaultRewards()) {
  const current = resolveAttendance(stored, today, rewards)
  if (current.checkedToday) throw new Error('오늘은 이미 출석했어요.')
  const day = current.cycleDay + 1
  const reward = rewards[day - 1] ?? { day, credit: 0, milestone: false }
  const next: StoredAttendance = { cycleDay: day, lastCheckedOn: today, totalDays: current.totalDays + 1 }
  return { stored: next, state: resolveAttendance(next, today, rewards), reward }
}

/** The cycle's rewards at `credit` a day (the server's `rewardPerDay`); milestones stay decoration. */
export const rewardsOf = (credit: number): AttendanceReward[] => defaultRewards().map(reward => ({ ...reward, credit }))

/** The day before a `YYYY-MM-DD` key. */
export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** Days attended before today that count: all of them, or the unbroken run that ends yesterday. */
export function countedDays(earlier: ReadonlySet<string>, today: string, counting: AttendanceCounting = ATTENDANCE_COUNTING) {
  if (counting === 'cumulative') return earlier.size
  let run = 0
  for (let day = previousDay(today); earlier.has(day); day = previousDay(day)) run++
  return run
}

/**
 * The cycle from the business days attended (34 `ATTENDANCE` items) by the rules in attendance-config.ts (now the
 * mock's: days attended, not in a row; a finished cycle starts again at day 1 the next day). `grantedToday`: a response
 * said today's credits were just granted (the list may not show it yet). `received`: today's button was pressed. Until
 * then today's credits are `pendingCredit` (already in the balance, not yet shown).
 */
export function attendanceFromDays(days: Iterable<string>, today: string, options: { grantedToday?: boolean; received?: boolean; credit?: number; counting?: AttendanceCounting } = {}): AttendanceState {
  const earlier = new Set(days)
  const serverToday = earlier.delete(today) || options.grantedToday === true
  const before = countedDays(earlier, today, options.counting)
  const credit = options.credit ?? DAILY_ATTENDANCE_CREDIT
  const rewards = rewardsOf(credit)
  // The cycle before today: the last check-in was some earlier day.
  const stored: StoredAttendance = { cycleDay: before === 0 ? 0 : ((before - 1) % CYCLE_DAYS) + 1, lastCheckedOn: before === 0 ? null : 'earlier', totalDays: earlier.size }
  if (serverToday && options.received) return { ...applyCheckIn(stored, today, rewards).state, pendingCredit: 0 }
  return { ...resolveAttendance(stored, today, rewards), pendingCredit: serverToday ? credit : 0 }
}
