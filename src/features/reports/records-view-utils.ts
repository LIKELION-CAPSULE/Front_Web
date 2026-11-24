import type { StudyRecord } from '../demo/types.ts'
import { duration } from '../../shared/lib/format.ts'
import { connectionDayKey } from '../records/connection-day.ts'
import { focusDetectedSeconds } from '../session/focus.ts'
import { cameraRecords, connectionSummary } from './connection-records.ts'
import { periodDays, type RecordPeriod, type RecordRange } from './record-period.ts'

export type IntensityLevel = 0 | 1 | 2 | 3 | 4

/**
 * Maps a day/month total to a 0-4 color intensity level relative to maxSeconds in the period.
 * Any non-zero record ALWAYS receives at least level 1 so recorded days stay distinct from empty days.
 */
export function calendarIntensityLevel(seconds: number, maxSeconds: number): IntensityLevel {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) return 1
  const ratio = seconds / maxSeconds
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export type ChartTick = {
  value: number
  label: string
}

export type ChartScale = {
  maxSeconds: number
  ticks: readonly ChartTick[]
}

const NICE_STEP_SECONDS = [
  300,    // 5분
  600,    // 10분
  900,    // 15분
  1800,   // 30분
  3600,   // 1시간
  7200,   // 2시간
  10800,  // 3시간
  14400,  // 4시간
  18000,  // 5시간
  36000,  // 10시간
  72000,  // 20시간
  108000, // 30시간
  180000, // 50시간
] as const

/**
 * Computes clean Korean-formatted Y-axis ticks ("30분", "1시간", "2시간", ...) for bar charts.
 */
export function computeChartScale(maxSeconds: number): ChartScale {
  const safeMax = Number.isFinite(maxSeconds) && maxSeconds > 0 ? maxSeconds : 0
  if (safeMax === 0) {
    return {
      maxSeconds: 1800,
      ticks: [
        { value: 900, label: duration(900) },
        { value: 1800, label: duration(1800) },
      ],
    }
  }

  // Pick a clean step so 3 or 4 ticks cover safeMax cleanly
  let step = NICE_STEP_SECONDS[NICE_STEP_SECONDS.length - 1]!
  let count = 4
  for (const candidate of NICE_STEP_SECONDS) {
    if (candidate * 3 >= safeMax) {
      step = candidate
      count = Math.max(2, Math.ceil(safeMax / candidate))
      break
    }
    if (candidate * 4 >= safeMax) {
      step = candidate
      count = Math.ceil(safeMax / candidate)
      break
    }
  }
  if (step * count < safeMax) {
    count = Math.ceil(safeMax / step)
  }

  const ceiling = step * count
  const ticks: ChartTick[] = []
  for (let i = 1; i <= count; i++) {
    const value = step * i
    ticks.push({ value, label: duration(value) })
  }
  return { maxSeconds: ceiling, ticks }
}

export type RecordsSummaryDisplay = {
  /** "이번 주 함께한 시간" — 함께한 시간 is the connection time. */
  primaryLabel: string
  primarySeconds: number
  /** "카메라로 함께한 시간 …", or null when no camera time was measured. */
  cameraCaption: string | null
  cameraSeconds: number
  connectionSeconds: number
  activeDays: number
  sessions: number
  mates: number
}

/**
 * Summary card values for /records. The headline is always the connection time (shown as "함께한 시간"),
 * so users with the camera off still see their records. Camera-measured time is a secondary caption only.
 */
export function resolveSummaryDisplay(
  records: readonly StudyRecord[],
  range: RecordRange,
  isCurrentPeriod: boolean,
): RecordsSummaryDisplay {
  const summary = connectionSummary(records)
  const cameraSeconds = cameraRecords(records).reduce((sum, record) => sum + record.studySeconds, 0)
  const connectionSeconds = summary.connectionSeconds ?? 0
  const periodPrefix = isCurrentPeriod
    ? range.period === 'week'
      ? '이번 주'
      : range.period === 'month'
        ? '이번 달'
        : '올해'
    : range.dateLabel

  return {
    primaryLabel: `${periodPrefix} 함께한 시간`,
    primarySeconds: connectionSeconds,
    cameraCaption: cameraSeconds > 0 ? `카메라로 함께한 시간 ${duration(cameraSeconds)}` : null,
    cameraSeconds,
    connectionSeconds,
    activeDays: new Set(records.map((record) => connectionDayKey(record))).size,
    sessions: summary.sessions ?? 0,
    mates: summary.mates ?? 0,
  }
}

export type CalendarCell = {
  key: string
  label: string
  fullLabel: string
  cameraSeconds: number
  connectionSeconds: number
  sessions: number
  level: IntensityLevel
  isCurrent: boolean
  disabled: boolean
}

export type RecordsCalendarData = {
  mode: 'week' | 'month' | 'year'
  leadingBlanks: number
  cells: readonly CalendarCell[]
}

const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const

/**
 * Day (week/month) or month (year) buckets behind the bar chart. Level follows connection time.
 */
export function buildCalendarData(
  records: readonly StudyRecord[],
  range: RecordRange,
): RecordsCalendarData {
  if (range.period === 'year') {
    const yearStr = range.startDay.slice(0, 4)
    const todayMonth = range.today.slice(0, 7)
    const buckets = new Map<string, { camera: number; connection: number; sessions: number }>()

    for (const record of records) {
      const mKey = connectionDayKey(record).slice(0, 7)
      const prev = buckets.get(mKey) ?? { camera: 0, connection: 0, sessions: 0 }
      prev.camera += record.cameraFocus ? focusDetectedSeconds(record) : 0
      prev.connection += record.studySeconds
      prev.sessions += 1
      buckets.set(mKey, prev)
    }

    const rawCells = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1
      const key = `${yearStr}-${String(month).padStart(2, '0')}`
      const isFuture = key > todayMonth
      const stats = isFuture ? { camera: 0, connection: 0, sessions: 0 } : (buckets.get(key) ?? { camera: 0, connection: 0, sessions: 0 })
      const intensityValue = isFuture ? 0 : stats.connection
      return {
        key,
        label: `${month}월`,
        fullLabel: `${Number(yearStr)}년 ${month}월`,
        cameraSeconds: stats.camera,
        connectionSeconds: stats.connection,
        sessions: stats.sessions,
        intensityValue,
        isCurrent: key === todayMonth,
        disabled: isFuture,
      }
    })

    const maxVal = rawCells.reduce((m, c) => Math.max(m, c.intensityValue), 0)
    return {
      mode: 'year',
      leadingBlanks: 0,
      cells: rawCells.map(({ intensityValue, ...rest }) => ({
        ...rest,
        level: rest.disabled ? 0 : calendarIntensityLevel(intensityValue, maxVal),
      })),
    }
  }

  const days = periodDays(range)
  const dayBuckets = new Map<string, { camera: number; connection: number; sessions: number }>()
  for (const record of records) {
    const key = connectionDayKey(record)
    const prev = dayBuckets.get(key) ?? { camera: 0, connection: 0, sessions: 0 }
    prev.camera += record.cameraFocus ? focusDetectedSeconds(record) : 0
    prev.connection += record.studySeconds
    prev.sessions += 1
    dayBuckets.set(key, prev)
  }

  const leadingBlanks =
    range.period === 'month'
      ? (new Date(`${range.startDay}T12:00:00+09:00`).getUTCDay() + 6) % 7
      : 0

  const rawCells = days.map((key, idx) => {
    const isFuture = key > range.today
    const stats = isFuture ? { camera: 0, connection: 0, sessions: 0 } : (dayBuckets.get(key) ?? { camera: 0, connection: 0, sessions: 0 })
    const monthNum = Number(key.slice(5, 7))
    const dayNum = Number(key.slice(8, 10))
    const intensityValue = isFuture ? 0 : stats.connection
    return {
      key,
      label: range.period === 'week' ? `${WEEKDAY_NAMES[idx % 7]} ${dayNum}` : String(dayNum),
      fullLabel: `${monthNum}월 ${dayNum}일`,
      cameraSeconds: stats.camera,
      connectionSeconds: stats.connection,
      sessions: stats.sessions,
      intensityValue,
      isCurrent: key === range.today,
      disabled: isFuture,
    }
  })

  const maxVal = rawCells.reduce((m, c) => Math.max(m, c.intensityValue), 0)
  return {
    mode: range.period,
    leadingBlanks,
    cells: rawCells.map(({ intensityValue, ...rest }) => ({
      ...rest,
      level: rest.disabled ? 0 : calendarIntensityLevel(intensityValue, maxVal),
    })),
  }
}

export type BarBucket = {
  key: string
  axisLabel: string
  fullLabel: string
  cameraSeconds: number
  connectionSeconds: number
  sessions: number
}

export type BarChartData = {
  buckets: readonly BarBucket[]
  scale: ChartScale
  ariaSummary: string
}

/**
 * Builds daily/monthly bar chart buckets and accessible summary for week (7), month (28-31), or year (12).
 */
export function buildBarChartData(
  records: readonly StudyRecord[],
  range: RecordRange,
  isCurrentPeriod: boolean,
): BarChartData {
  const calendar = buildCalendarData(records, range)
  const buckets: BarBucket[] = calendar.cells.map((cell, idx) => ({
    key: cell.key,
    axisLabel:
      range.period === 'week'
        ? WEEKDAY_NAMES[idx % 7]!
        : range.period === 'month'
          ? cell.label
          : cell.label,
    fullLabel: cell.fullLabel,
    cameraSeconds: cell.cameraSeconds,
    connectionSeconds: cell.connectionSeconds,
    sessions: cell.sessions,
  }))

  const maxBar = buckets.reduce(
    (m, b) => Math.max(m, b.connectionSeconds),
    0,
  )
  const scale = computeChartScale(maxBar)

  const periodPrefix = isCurrentPeriod
    ? range.period === 'week'
      ? '이번 주'
      : range.period === 'month'
        ? '이번 달'
        : '올해'
    : range.dateLabel

  const activeBuckets = buckets.filter((b) => b.sessions > 0)
  const unit = range.period === 'year' ? '개월' : '일'
  const top = activeBuckets.reduce<BarBucket | null>((best, cur) => {
    const bestVal = best ? best.connectionSeconds : -1
    const curVal = cur.connectionSeconds
    return curVal > bestVal ? cur : best
  }, null)

  const ariaSummary = top
    ? `${periodPrefix} 함께한 시간 ${activeBuckets.length}${unit}, 가장 많은 ${range.period === 'year' ? '달' : '날'} ${top.fullLabel} ${duration(top.connectionSeconds)}`
    : `${periodPrefix} 함께한 기록 없음`

  return { buckets, scale, ariaSummary }
}

export function parseRecordsParams(searchParams: URLSearchParams): {
  period: RecordPeriod
  offset: number
  mate: string | null
} {
  const rawPeriod = searchParams.get('period')
  const period: RecordPeriod =
    rawPeriod === 'month' || rawPeriod === 'year' ? rawPeriod : 'week'
  const rawOffset = Number(searchParams.get('offset'))
  const offset = Number.isInteger(rawOffset) ? rawOffset : 0
  const rawMate = searchParams.get('mate')?.trim()
  const mate = rawMate && rawMate !== 'all' ? rawMate : null
  return { period, offset, mate }
}
