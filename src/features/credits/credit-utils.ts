import type { BetaCreditEntry } from './beta-types.ts'
import { dayKey } from '../../shared/lib/format.ts'

export const CREDIT_PRICING = {
  dailyAttendance: 1500,
  inviteReward: 1000,
  inviteMaxCount: 10,
  basicChat: 0,
  voice: 20,
  advanced: 30,
  voiceAndAdvanced: 50,
} as const

/**
 * Returns the remaining attendance credit ratio in [0, 1] against the daily cap (1,500).
 */
export function attendanceBarRatio(
  attendance: number,
  dailyMax: number = CREDIT_PRICING.dailyAttendance,
): number {
  if (!Number.isFinite(attendance) || !Number.isFinite(dailyMax) || dailyMax <= 0) return 0
  return Math.max(0, Math.min(1, attendance / dailyMax))
}

export interface CreditDateGroup {
  dateKey: string
  dateHeading: string
  entries: BetaCreditEntry[]
}

const seoulMonthDayFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
})

/**
 * Groups credit ledger entries by calendar date (Asia/Seoul) while preserving entry order.
 */
export function groupCreditEntriesByDate(entries: readonly BetaCreditEntry[]): CreditDateGroup[] {
  const groups: CreditDateGroup[] = []
  for (const entry of entries) {
    const key = dayKey(entry.at)
    const last = groups.at(-1)
    if (last && last.dateKey === key) {
      last.entries.push(entry)
    } else {
      groups.push({
        dateKey: key,
        dateHeading: seoulMonthDayFormatter.format(entry.at),
        entries: [entry],
      })
    }
  }
  return groups
}
