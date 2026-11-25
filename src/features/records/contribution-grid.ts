import { duration } from '../../shared/lib/format.ts'

/**
 * 내 기록 2D (user decision 2026-11-26): a contribution grid like GitHub's — one cell a day, its shade the day's time
 * together. Pure and renderer-free (unit-tested); drawn by ContributionGrid.tsx.
 *
 * - Year: columns are weeks (Monday first), rows the weekdays; month names above the column where each month starts,
 *   월 · 수 · 금 at the left.
 * - Month: a calendar of 7 columns (rows = weeks). Week: one row of 7.
 * - A day is the server's day (from 05:00 Seoul time, records/connection-day.ts): the days come in as keys already.
 * - Shade: absolute steps (`GRID_LEVELS`), so a day reads the same in every period and for every mate filter.
 */

export type GridLevel = 0 | 1 | 2 | 3 | 4
export type GridMode = 'week' | 'month' | 'year'

/** The day's time together → shade 1–4 (0: no time). */
export const GRID_LEVELS = [
  { level: 1, minSeconds: 1, label: '30분 미만' },
  { level: 2, minSeconds: 30 * 60, label: '30분 이상' },
  { level: 3, minSeconds: 60 * 60, label: '1시간 이상' },
  { level: 4, minSeconds: 2 * 60 * 60, label: '2시간 이상' },
] as const satisfies readonly { level: GridLevel; minSeconds: number; label: string }[]

export function gridLevel(seconds: number): GridLevel {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  let level: GridLevel = 0
  for (const step of GRID_LEVELS) if (seconds >= step.minSeconds) level = step.level
  return level
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

/** 0 = Monday … 6 = Sunday, of a calendar date (`YYYY-MM-DD`). */
export function weekdayOfKey(key: string): number {
  return (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7
}

export type GridCell = { index: number; key: string; col: number; row: number }
export type GridLayout = {
  mode: GridMode
  columns: number
  rows: number
  cells: GridCell[]
  /** Year: a month name over the week column where the month's first day falls (too close to the last: skipped). */
  monthLabels: { label: string; col: number }[]
}

/** Columns a month name needs before the next one may show (GitHub skips a label that would overlap). */
const MONTH_LABEL_GAP = 3

/** Where each day of a period sits. `keys`: the period's days in order (record-period.ts `periodDays`). */
export function gridLayout(mode: GridMode, keys: readonly string[]): GridLayout {
  if (mode === 'week') {
    return { mode, columns: 7, rows: 1, cells: keys.map((key, index) => ({ index, key, col: index, row: 0 })), monthLabels: [] }
  }
  const lead = keys.length ? weekdayOfKey(keys[0]!) : 0
  const span = lead + keys.length
  if (mode === 'month') {
    const cells = keys.map((key, index) => ({ index, key, col: (lead + index) % 7, row: Math.floor((lead + index) / 7) }))
    return { mode, columns: 7, rows: Math.max(1, Math.ceil(span / 7)), cells, monthLabels: [] }
  }
  const cells = keys.map((key, index) => ({ index, key, col: Math.floor((lead + index) / 7), row: (lead + index) % 7 }))
  const monthLabels: { label: string; col: number }[] = []
  for (const cell of cells) {
    if (!cell.key.endsWith('-01') && cell.index !== 0) continue
    const label = `${Number(cell.key.slice(5, 7))}월`
    const previous = monthLabels[monthLabels.length - 1]
    if (previous && cell.col - previous.col < MONTH_LABEL_GAP) {
      // The year's first label gives way to the month that follows it closely (a year starting late in a month).
      if (previous.col === 0 && monthLabels.length === 1) monthLabels.pop()
      else continue
    }
    monthLabels.push({ label, col: cell.col })
  }
  return { mode, columns: Math.max(1, Math.ceil(span / 7)), rows: 7, cells, monthLabels }
}

/** The year's weekday labels at the left: 월 · 수 · 금 only (GitHub). */
export const yearWeekdayLabel = (row: number) => (row === 0 || row === 2 || row === 4 ? WEEKDAY_LABELS[row]! : '')

/**
 * Arrow keys between days, the same moves as the board: year ↑↓ one day, ←→ one week; month ←→ one day, ↑↓ one
 * week; week ←→. Home / End: the first / the last day that has begun. Future days cannot be reached. Null when the key
 * does not move.
 */
export function gridNeighbor(mode: GridMode, index: number, key: string, days: readonly { isFuture: boolean }[]): number | null {
  const lastSelectable = days.findLastIndex((day) => !day.isFuture)
  if (lastSelectable < 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return lastSelectable
  const steps: Record<GridMode, Record<string, number>> = {
    year: { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 },
    month: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 },
    week: { ArrowLeft: -1, ArrowRight: 1 },
  }
  const step = steps[mode][key]
  if (step === undefined) return null
  const target = index + step
  return target < 0 || target > lastSelectable ? index : target
}

export type GridDay = {
  key: string
  fullLabel: string
  connectionSeconds: number
  isToday: boolean
  isFuture: boolean
}
export type GridDayMate = { name: string; seconds: number }

/**
 * Tooltip lines (the cell's accessible name joins them): the date, the time together, and with 「전체」 each mate's
 * time. No connection count: a day of 38 is a sum, not a list of connections.
 */
export function gridTooltip(day: GridDay, mates: readonly GridDayMate[] = []): string[] {
  const date = day.isToday ? `${day.fullLabel} (오늘)` : day.fullLabel
  if (day.isFuture) return [date, '아직 오지 않은 날']
  if (!(day.connectionSeconds > 0)) return [date, '기록 없음']
  const lines = [date, `함께한 시간 ${duration(day.connectionSeconds)}`]
  const shown = mates.filter((mate) => mate.seconds > 0)
  if (shown.length) lines.push(shown.map((mate) => `${mate.name} ${duration(mate.seconds)}`).join(' · '))
  return lines
}
