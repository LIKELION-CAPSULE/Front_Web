import type { StudyRecord } from '../demo/types.ts'
import { duration } from '../../shared/lib/format.ts'
import { byConnectionStartDesc, connectionDayKey, connectionStartedAt } from './connection-day.ts'
import { timeBand, timeBandLabels, type TimeBand } from './mate-comment.ts'
import { focusDetectedSeconds } from '../session/focus.ts'
import { periodDays, type RecordRange } from '../reports/record-period.ts'
import { CHAERIN_JAR_THEME, capsuleBandTheme } from '../mates/capsule-jar/capsule-jar-theme.ts'

/**
 * Capsule calendar for /records: every day is a small capsule that fills with light by that day's
 * connection time ("함께한 시간"). Camera-measured time is kept only as secondary information.
 *
 * Like the capsules of 내 메이트, a day's light takes the tint of its **time band** (the band of a connection's start,
 * `timeBand`). A day with connections in several bands takes the band where the most time was spent (ties: the band
 * of the earlier connection) — one colour per capsule, so the small year capsules stay readable. A day on which the
 * time together passed a milestone (capsule-moments.ts `capsuleKeepsakes`) carries a keepsake mark.
 */

export type CapsuleFillLevel = 0 | 1 | 2 | 3 | 4

/**
 * Light colour of a day by time band: the deep tone of the brand capsule (채린's jar theme, `tintHalfShade`) moved by
 * the same band shifts as the capsules of 내 메이트 (capsule-jar-theme.ts `capsuleBandTheme`). The calendar is the
 * user's record across mates, so it keeps the brand violet whichever mate a day belongs to.
 */
export const CAPSULE_BASE_FILL = CHAERIN_JAR_THEME.tintHalfShade
export const capsuleBandFill: Readonly<Record<TimeBand, string>> = {
  dawn: capsuleBandTheme(CHAERIN_JAR_THEME, 'dawn').tintHalfShade,
  morning: capsuleBandTheme(CHAERIN_JAR_THEME, 'morning').tintHalfShade,
  day: capsuleBandTheme(CHAERIN_JAR_THEME, 'day').tintHalfShade,
  evening: capsuleBandTheme(CHAERIN_JAR_THEME, 'evening').tintHalfShade,
  night: capsuleBandTheme(CHAERIN_JAR_THEME, 'night').tintHalfShade,
}

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
  /** Time band whose tint the day's light takes (null without a record). */
  band: TimeBand | null
  /** More than one band that day (the tooltip says 「주로 …」). */
  mixedBands: boolean
  /** Milestone of the time together passed that day (hours), if any. */
  keepsakeHours: number | null
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

type DayBucket = {
  connection: number
  camera: number
  sessions: number
  /** Seconds per band, in the order the bands first appeared that day (by start). */
  bands: Map<TimeBand, number>
  keepsake: number | null
}

const emptyBucket = (): DayBucket => ({ connection: 0, camera: 0, sessions: 0, bands: new Map(), keepsake: null })

/** The band with the most time; ties keep the band that appeared first (the earlier connection). */
function dominantBand(bands: ReadonlyMap<TimeBand, number>): TimeBand | null {
  let best: TimeBand | null = null
  let bestSeconds = -1
  for (const [band, seconds] of bands) {
    if (seconds > bestSeconds) {
      best = band
      bestSeconds = seconds
    }
  }
  return best
}

/**
 * `keepsakes`: milestone hours by record id (capsule-moments.ts `capsuleKeepsakes`, counted over each mate's whole
 * history, so a period shows the milestones passed inside it).
 */
export function buildCapsuleCalendar(
  records: readonly StudyRecord[],
  range: RecordRange,
  keepsakes: ReadonlyMap<string, number> = new Map(),
): CapsuleCalendarData {
  const buckets = new Map<string, DayBucket>()
  const ordered = [...records].sort((a, b) => connectionStartedAt(a) - connectionStartedAt(b))
  for (const record of ordered) {
    const key = connectionDayKey(record)
    const bucket = buckets.get(key) ?? emptyBucket()
    const seconds = Math.max(0, Number.isFinite(record.studySeconds) ? record.studySeconds : 0)
    bucket.connection += record.studySeconds
    bucket.camera += record.cameraFocus ? focusDetectedSeconds(record) : 0
    bucket.sessions += 1
    const band = timeBand(connectionStartedAt(record))
    bucket.bands.set(band, (bucket.bands.get(band) ?? 0) + seconds)
    const keepsake = keepsakes.get(record.id)
    if (keepsake) bucket.keepsake = Math.max(bucket.keepsake ?? 0, keepsake)
    buckets.set(key, bucket)
  }

  const keys = periodDays(range)
  const days = keys.map((key): CapsuleDay => {
    const isFuture = key > range.today
    const stats = (!isFuture && buckets.get(key)) || emptyBucket()
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
      band: stats.sessions > 0 ? dominantBand(stats.bands) : null,
      mixedBands: stats.bands.size > 1,
      keepsakeHours: stats.keepsake,
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

/** 「저녁」, or 「주로 저녁」 when the day had connections in several bands. */
export function capsuleBandLabel(day: Pick<CapsuleDay, 'band' | 'mixedBands'>): string | null {
  if (!day.band) return null
  return day.mixedBands ? `주로 ${timeBandLabels[day.band]}` : timeBandLabels[day.band]
}

/** 「함께한 지 10시간」 (the keepsake of the day). */
export function capsuleKeepsakeLabel(hours: number): string {
  return `함께한 지 ${hours}시간`
}

/** Tooltip: date, 함께한 시간, count, time band, keepsake. */
export function capsuleTooltip(day: CapsuleDay): string {
  const date = day.isToday ? `${day.fullLabel} (오늘)` : day.fullLabel
  if (day.isFuture) return `${date} · 아직 오지 않은 날`
  if (day.sessions === 0) return `${date} · 기록 없음`
  const parts = [date, `함께한 시간 ${duration(day.connectionSeconds)}`, `${day.sessions}회`]
  const band = capsuleBandLabel(day)
  if (band) parts.push(band)
  if (day.keepsakeHours) parts.push(capsuleKeepsakeLabel(day.keepsakeHours))
  return parts.join(' · ')
}

/** Summary line for the selected day. Camera time appears only when it was measured. */
export function capsuleDaySummary(day: CapsuleDay): string {
  const parts = [day.fullLabel]
  if (day.isToday) parts.push('오늘')
  if (day.sessions === 0) return `${parts.join(' · ')} · 이날은 기록이 없어요.`
  parts.push(`함께한 시간 ${duration(day.connectionSeconds)}`, `연결 ${day.sessions}회`)
  if (day.cameraSeconds > 0) parts.push(`카메라로 함께한 시간 ${duration(day.cameraSeconds)}`)
  if (day.keepsakeHours) parts.push(capsuleKeepsakeLabel(day.keepsakeHours))
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
