import type { StudyRecord } from '../demo/types.ts'
import { duration } from '../../shared/lib/format.ts'
import { byConnectionStartDesc, connectionDayKey } from './connection-day.ts'
import { focusDetectedSeconds } from '../session/focus.ts'
import { periodDays, type RecordRange } from '../reports/record-period.ts'

/**
 * Capsule calendar for /records: every day is a small capsule that fills with light by that day's
 * connection time ("함께한 시간"). Camera-measured time is kept only as secondary information.
 */

export type CapsuleFillLevel = 0 | 1 | 2 | 3 | 4

/** Absolute steps, so a day means the same thing in week, month and year views. */
export const capsuleFillSteps = [
  { level: 1, minSeconds: 1, label: '30분 미만' },
  { level: 2, minSeconds: 30 * 60, label: '30분+' },
  { level: 3, minSeconds: 60 * 60, label: '1시간+' },
  { level: 4, minSeconds: 2 * 60 * 60, label: '2시간+' },
] as const satisfies readonly { level: CapsuleFillLevel; minSeconds: number; label: string }[]

export function capsuleFillLevel(seconds: number): CapsuleFillLevel {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  let level: CapsuleFillLevel = 0
  for (const step of capsuleFillSteps) if (seconds >= step.minSeconds) level = step.level
  return level
}

/** Share of the capsule body filled with light for a level. */
export function capsuleFillRatio(level: CapsuleFillLevel): number {
  return [0, 0.3, 0.55, 0.78, 1][level]!
}

export type CapsuleDay = {
  key: string
  /** Visible label: "월 23" (week), "23" (month), "" (year). */
  label: string
  /** "11월 23일" */
  fullLabel: string
  /** 0 = Monday … 6 = Sunday */
  weekday: number
  connectionSeconds: number
  cameraSeconds: number
  sessions: number
  level: CapsuleFillLevel
  isToday: boolean
  isFuture: boolean
}

export type CapsuleCalendarData = {
  mode: RecordRange['period']
  /** Empty slots before the first day so weekdays line up (month: row start, year: column start). */
  leadingBlanks: number
  days: readonly CapsuleDay[]
  /** Year view: grid column (0-based week column) where each month starts. */
  monthMarks: readonly { label: string; column: number }[]
}

const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const

function weekdayOf(key: string) {
  return (new Date(`${key}T12:00:00+09:00`).getUTCDay() + 6) % 7
}

export function buildCapsuleCalendar(records: readonly StudyRecord[], range: RecordRange): CapsuleCalendarData {
  const buckets = new Map<string, { connection: number; camera: number; sessions: number }>()
  for (const record of records) {
    const key = connectionDayKey(record)
    const bucket = buckets.get(key) ?? { connection: 0, camera: 0, sessions: 0 }
    bucket.connection += record.studySeconds
    bucket.camera += record.cameraFocus ? focusDetectedSeconds(record) : 0
    bucket.sessions += 1
    buckets.set(key, bucket)
  }

  const keys = periodDays(range)
  const days = keys.map((key): CapsuleDay => {
    const isFuture = key > range.today
    const stats = (!isFuture && buckets.get(key)) || { connection: 0, camera: 0, sessions: 0 }
    const weekday = weekdayOf(key)
    const dayNum = Number(key.slice(8, 10))
    return {
      key,
      label: range.period === 'week' ? `${WEEKDAY_NAMES[weekday]} ${dayNum}` : range.period === 'month' ? String(dayNum) : '',
      fullLabel: `${Number(key.slice(5, 7))}월 ${dayNum}일`,
      weekday,
      connectionSeconds: stats.connection,
      cameraSeconds: stats.camera,
      sessions: stats.sessions,
      level: capsuleFillLevel(stats.connection),
      isToday: key === range.today,
      isFuture,
    }
  })

  const leadingBlanks = range.period === 'week' || days.length === 0 ? 0 : days[0]!.weekday
  const monthMarks =
    range.period === 'year'
      ? days.flatMap((day, index) =>
          day.key.endsWith('-01') || index === 0
            ? [{ label: `${Number(day.key.slice(5, 7))}월`, column: Math.floor((index + leadingBlanks) / 7) }]
            : [],
        )
      : []
  return { mode: range.period, leadingBlanks, days, monthMarks }
}

/**
 * Staggered fill-in for the days that have records. Empty capsules never animate. The whole reveal always takes
 * `totalMs` (inside 0.8–1.2 s) however many days are filled: with few days each capsule fills more slowly,
 * with many days the step between them shrinks.
 */
export function capsuleRevealTiming(filledCount: number, totalMs = 1000) {
  const minFillMs = 320
  const maxStepMs = 110
  const stepMs = filledCount > 1 ? Math.min(maxStepMs, (totalMs - minFillMs) / (filledCount - 1)) : 0
  const fillMs = totalMs - stepMs * Math.max(0, filledCount - 1)
  return { fillMs, stepMs, totalMs: filledCount > 0 ? totalMs : 0 }
}

/** Reveal order: days with records in date order (0, 1, 2 …); empty or future days get null. */
export function capsuleRevealOrder(days: readonly Pick<CapsuleDay, 'level' | 'isFuture'>[]): (number | null)[] {
  let next = 0
  return days.map((day) => (day.level > 0 && !day.isFuture ? next++ : null))
}

/**
 * Keyboard movement between capsules. Week: ←/→. Month (rows = weeks): ←/→ one day, ↑/↓ one week.
 * Year (columns = weeks, rows = weekdays): ↑/↓ one day, ←/→ one week. Home/End jump to the first/last
 * selectable day. Future days are not selectable. Returns null when the key does not move focus.
 */
export function capsuleNeighbor(
  mode: RecordRange['period'],
  index: number,
  key: string,
  days: readonly Pick<CapsuleDay, 'isFuture'>[],
): number | null {
  const lastSelectable = days.findLastIndex((day) => !day.isFuture)
  if (lastSelectable < 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return lastSelectable
  const step =
    mode === 'year'
      ? { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[key]
      : mode === 'month'
        ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key]
        : { ArrowLeft: -1, ArrowRight: 1 }[key]
  if (step === undefined) return null
  const target = index + step
  if (target < 0 || target > lastSelectable) return index
  return target
}

/** Tooltip: date, 함께한 시간, count. */
export function capsuleTooltip(day: CapsuleDay): string {
  const date = day.isToday ? `${day.fullLabel} (오늘)` : day.fullLabel
  if (day.isFuture) return `${date} · 아직 오지 않은 날`
  if (day.sessions === 0) return `${date} · 기록 없음`
  return `${date} · 함께한 시간 ${duration(day.connectionSeconds)} · ${day.sessions}회`
}

/** Summary line for the selected day. Camera time appears only when it was measured. */
export function capsuleDaySummary(day: CapsuleDay): string {
  const parts = [day.fullLabel]
  if (day.isToday) parts.push('오늘')
  if (day.sessions === 0) return `${parts.join(' · ')} · 이날은 기록이 없어요.`
  parts.push(`함께한 시간 ${duration(day.connectionSeconds)}`, `연결 ${day.sessions}회`)
  if (day.cameraSeconds > 0) parts.push(`카메라로 함께한 시간 ${duration(day.cameraSeconds)}`)
  return parts.join(' · ')
}

/** Selected day hand-off: the day plus its records, newest first. */
export type SelectedCapsuleDay = { day: CapsuleDay; records: readonly StudyRecord[] }

export function selectCapsuleDay(records: readonly StudyRecord[], day: CapsuleDay): SelectedCapsuleDay {
  return {
    day,
    records: records.filter((record) => connectionDayKey(record) === day.key).sort(byConnectionStartDesc),
  }
}

/** Default selection: today in the current period, else the latest day with a record, else the first day. */
export function defaultCapsuleDay(days: readonly CapsuleDay[]): CapsuleDay | undefined {
  return days.find((day) => day.isToday) ?? [...days].reverse().find((day) => day.sessions > 0) ?? days[0]
}
