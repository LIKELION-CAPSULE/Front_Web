import type { StudyRecord } from '../../demo/types.ts'
import type { RecordRange } from '../../reports/record-period.ts'
import { capsulesForConnection, KEEPSAKE_SCALE } from '../../mates/capsule-jar/capsule-floor-layout.ts'
import type { CapsuleKeepsake } from '../../mates/capsule-jar/capsule-moments.ts'
import { buildCapsuleCalendar, type CapsuleCalendarData, type CapsuleDay } from '../capsule-calendar.ts'
import { connectionDayKey, connectionStartedAt } from '../connection-day.ts'
import { timeBand, type TimeBand } from '../mate-comment.ts'

/**
 * 「함께 쌓은 시간」 board (/records, 2.5D): every day is a floor tile and the day's time together stands on it as a
 * column of upright capsules — the height is the time. Pure and renderer-free (unit-tested); the WebGL scene is
 * capsule-board-scene.ts.
 *
 * Height rule: **one capsule = 30 minutes of the day's time together**, the same for every day, week, month and
 * year, so heights compare at a glance. 내 메이트 counts 10 minutes per capsule with at least 3 and at most 18 per
 * connection (`CAPSULE_COUNT`): good for a heap, but its floor of 3 makes a 5-minute and a 30-minute connection the
 * same height and its cap flattens long days, so it is not used for heights. The day total is rounded to whole
 * capsules (±15 min, the tooltip has the exact time) and shared among the day's connections in start order (largest
 * remainder), every connection keeping at least one capsule so each connection's colour shows.
 *
 * Cap: a column is at most `BOARD.maxLevels` capsules tall (4 hours). A taller day keeps all its capsules but packs
 * them into that height (they overlap, so the glass reads denser and brighter) and is marked `compressed`.
 */

export const BOARD = {
  minutesPerCapsule: 30,
  /** Column cap in capsule heights (= 4 hours). */
  maxLevels: 8,
  /** Capsule length in tile units (tile pitch = 1). */
  capsuleLength: 0.5,
  /** The year's 365 small tiles: longer capsules so the garden reads (heights still compare within the view). */
  yearCapsuleLength: 0.6,
  /** Floor tile side and thickness (tile pitch = 1). */
  tileSize: 0.86,
  tileHeight: 0.07,
} as const

export type BoardMode = RecordRange['period']

export type BoardCapsule = {
  /** `${recordId}:${piece}` */
  id: string
  recordId: string
  band: TimeBand
  /** Milestone hours of a keepsake capsule (larger, stars on the seam), else 0. */
  keepsake: number
  /** Centre height above the tile top. */
  y: number
  length: number
  /** Rotation around the capsule's own axis (a small deterministic variation). */
  roll: number
  /** 0…1 natural variation of the core light. */
  glow: number
}

export type BoardTile = {
  index: number
  day: CapsuleDay
  /** Grid position (x to the right, z towards the viewer). */
  x: number
  z: number
  capsules: readonly BoardCapsule[]
  /** Height of the column above the tile top (0 without records). */
  height: number
  compressed: boolean
}

export type BoardLabel = { text: string; x: number; z: number; size: number; kind: 'date' | 'month'; today: boolean }

export type CapsuleBoardModel = {
  mode: BoardMode
  /** Length of one capsule (one 30-minute level) in this view. */
  capsuleLength: number
  cols: number
  rows: number
  tiles: readonly BoardTile[]
  labels: readonly BoardLabel[]
  /** The 2D calendar of the same days (fallback without WebGL, keyboard order, tooltips). */
  calendar: CapsuleCalendarData
  /** Tallest column in this view. */
  maxHeight: number
  capsuleCount: number
}

/** Whole capsules for a day's total time (at least one per connection). */
export function dayCapsuleCount(totalSeconds: number, connections: number) {
  const byTime = Math.round(Math.max(0, totalSeconds) / 60 / BOARD.minutesPerCapsule)
  return Math.max(connections, byTime, connections > 0 ? 1 : 0)
}

/**
 * Shares a day's capsules among its connections (in start order) by their time: largest remainder, at least one each.
 */
export function capsulesPerConnection(secondsList: readonly number[]): number[] {
  const seconds = secondsList.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  const total = seconds.reduce((sum, value) => sum + value, 0)
  const count = dayCapsuleCount(total, seconds.length)
  if (seconds.length === 0) return []
  const spare = count - seconds.length
  const ideal = seconds.map((value) => (total > 0 ? (value / total) * spare : spare / seconds.length))
  const result = ideal.map((value) => 1 + Math.floor(value))
  let left = count - result.reduce((sum, value) => sum + value, 0)
  const order = ideal
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of order) {
    if (left <= 0) break
    result[index]! += 1
    left -= 1
  }
  return result
}

function hash(value: string) {
  let state = 2166136261
  for (let index = 0; index < value.length; index++) {
    state ^= value.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  return (state >>> 0) / 4294967296
}

/** Lays out one day's column: capsules bottom → top by connection start, the keepsake one larger. */
export function stackDay(
  records: readonly StudyRecord[],
  keepsakes: ReadonlyMap<string, CapsuleKeepsake> = new Map(),
  capsuleLength: number = BOARD.capsuleLength,
): { capsules: BoardCapsule[]; height: number; compressed: boolean } {
  const ordered = [...records].sort((a, b) => connectionStartedAt(a) - connectionStartedAt(b) || a.id.localeCompare(b.id))
  const counts = capsulesPerConnection(ordered.map((record) => record.studySeconds))
  const pieces: Omit<BoardCapsule, 'y'>[] = []
  ordered.forEach((record, recordIndex) => {
    const count = counts[recordIndex]!
    const band = timeBand(connectionStartedAt(record))
    const keepsake = keepsakes.get(record.id)
    // The mate's keepsake piece, at the same share of the connection in this column.
    const keepsakePiece = keepsake
      ? Math.min(count - 1, Math.floor((keepsake.piece / Math.max(1, capsulesForConnection(record.studySeconds))) * count))
      : -1
    for (let piece = 0; piece < count; piece++) {
      const id = `${record.id}:${piece}`
      const isKeepsake = piece === keepsakePiece
      pieces.push({
        id,
        recordId: record.id,
        band,
        keepsake: isKeepsake ? keepsake!.hours : 0,
        length: capsuleLength * (isKeepsake ? KEEPSAKE_SCALE : 1),
        roll: hash(id) * Math.PI * 2,
        glow: 0.55 + hash(`${id}|glow`) * 0.45,
      })
    }
  })
  const natural = pieces.reduce((sum, piece) => sum + piece.length, 0)
  const cap = BOARD.maxLevels * capsuleLength
  const compressed = natural > cap + 1e-9
  const squeeze = compressed ? cap / natural : 1
  let base = 0
  const capsules = pieces.map((piece) => {
    const step = piece.length * squeeze
    const capsule = { ...piece, y: base + step / 2 }
    base += step
    return capsule
  })
  return { capsules, height: base, compressed }
}

/** Grid position of a day (index in the period) for each view. */
export function boardCell(mode: BoardMode, index: number, leadingBlanks: number) {
  if (mode === 'week') return { x: index, z: 0 }
  const slot = index + leadingBlanks
  return mode === 'month' ? { x: slot % 7, z: Math.floor(slot / 7) } : { x: Math.floor(slot / 7), z: slot % 7 }
}

export function buildCapsuleBoard(
  records: readonly StudyRecord[],
  range: RecordRange,
  keepsakes: ReadonlyMap<string, CapsuleKeepsake> = new Map(),
): CapsuleBoardModel {
  const keepsakeHours = new Map([...keepsakes].map(([id, keepsake]) => [id, keepsake.hours]))
  const calendar = buildCapsuleCalendar(records, range, keepsakeHours)
  const byDay = new Map<string, StudyRecord[]>()
  for (const record of records) {
    const key = connectionDayKey(record)
    const list = byDay.get(key) ?? []
    list.push(record)
    byDay.set(key, list)
  }
  const mode = calendar.mode
  const capsuleLength = mode === 'year' ? BOARD.yearCapsuleLength : BOARD.capsuleLength
  let cols = 0
  let rows = 0
  let capsuleCount = 0
  let maxHeight = 0
  const tiles = calendar.days.map((day, index): BoardTile => {
    const { x, z } = boardCell(mode, index, calendar.leadingBlanks)
    cols = Math.max(cols, x + 1)
    rows = Math.max(rows, z + 1)
    const stack = day.isFuture
      ? { capsules: [], height: 0, compressed: false }
      : stackDay(byDay.get(day.key) ?? [], keepsakes, capsuleLength)
    capsuleCount += stack.capsules.length
    maxHeight = Math.max(maxHeight, stack.height)
    return { index, day, x, z, ...stack }
  })
  if (mode === 'month') cols = 7
  const labels: BoardLabel[] =
    mode === 'year'
      ? // In front of the garden (columns rise away from the viewer, so labels behind would be hidden).
        calendar.monthMarks.map((mark) => ({ text: mark.label, x: mark.column, z: rows - 0.4, size: 1.5, kind: 'month', today: false }))
      : tiles.map((tile) => ({
          text: tile.day.label,
          x: tile.x,
          z: tile.z,
          size: mode === 'week' ? 0.3 : 0.32,
          kind: 'date',
          today: tile.day.isToday,
        }))
  return { mode, capsuleLength, cols, rows, tiles, labels, calendar, maxHeight, capsuleCount }
}

/**
 * Rise timing: days with records in date order, each column building bottom-up. Fits `totalMs` (1–1.5 s) however
 * many days there are. Returns per tile its start delay (ms) or null (empty days never animate).
 */
export function boardRiseTiming(tiles: readonly Pick<BoardTile, 'capsules'>[], totalMs = 1300) {
  const riseMs = 420
  const pieceStepMs = 35
  const maxPieces = Math.max(1, ...tiles.map((tile) => tile.capsules.length))
  const stackMs = Math.min(260, pieceStepMs * (maxPieces - 1))
  const filled = tiles.filter((tile) => tile.capsules.length > 0).length
  const dayStepMs = filled > 1 ? Math.min(90, (totalMs - riseMs - stackMs) / (filled - 1)) : 0
  let next = 0
  const starts = tiles.map((tile) => (tile.capsules.length > 0 ? next++ * dayStepMs : null))
  return {
    starts,
    riseMs,
    pieceStepMs: maxPieces > 1 ? stackMs / (maxPieces - 1) : 0,
    totalMs: filled ? (filled - 1) * dayStepMs + stackMs + riseMs : 0,
  }
}
