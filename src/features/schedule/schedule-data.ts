import type { Memory } from '../demo/types.ts'
import { clampCalendarDate, clampCalendarMonth } from '../../shared/lib/date-limits.ts'

export type SchedulePeriod = 'upcoming' | 'all' | 'past'

/** Calendar arithmetic stays in UTC so a week always has seven calendar dates. */
export function scheduleWeekDays(day: string) {
  const start = new Date(`${clampCalendarDate(day)}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

export function shiftScheduleWeek(day: string, offset: number) {
  const date = new Date(`${clampCalendarDate(day)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset * 7)
  return clampCalendarDate(date.toISOString().slice(0, 10))
}

export function scheduleCountdown(date: string, today: string) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (!Number.isFinite(days) || days < 0) return null
  return days === 0 ? 'D-DAY' : `D-${days}`
}

export function scheduleMonthDays(
  month: string,
  { weekStartsOn = 1, showOutsideDays = false }: { weekStartsOn?: 0 | 1; showOutsideDays?: boolean } = {},
) {
  const first = new Date(`${month}-01T00:00:00Z`)
  const last = new Date(first)
  last.setUTCMonth(first.getUTCMonth() + 1, 0)
  const offset = (first.getUTCDay() - weekStartsOn + 7) % 7
  const days = last.getUTCDate()
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1
    if (day >= 1 && day <= days) return `${month}-${String(day).padStart(2, '0')}`
    if (!showOutsideDays) return null
    const outside = new Date(first)
    outside.setUTCDate(day)
    return outside.toISOString().slice(0, 10)
  })
}

export function shiftScheduleMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return clampCalendarMonth(date.toISOString().slice(0, 7))
}

export function selectSchedule(
  memories: readonly Memory[],
  period: SchedulePeriod,
  today: string,
) {
  return memories
    .filter((memory) =>
      period === 'all' || (!!memory.date && (period === 'past' ? memory.date < today : memory.date >= today)),
    )
    .sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.id.localeCompare(b.id)
      const aPast = a.date < today,
        bPast = b.date < today
      if (aPast !== bPast) return aPast ? 1 : -1
      const order = `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)
      return (aPast ? -order : order) || a.id.localeCompare(b.id)
    })
}
