import type { StudyRecord } from '../../demo/types.ts'
import type { RecordRange } from '../../reports/record-period.ts'
import { capsulesForConnection, KEEPSAKE_SCALE } from '../../mates/capsule-jar/capsule-floor-layout.ts'
import { capsuleBandTheme, capsuleJarTheme } from '../../mates/capsule-jar/capsule-jar-theme.ts'
import type { CapsuleKeepsake } from '../../mates/capsule-jar/capsule-moments.ts'
import { buildCapsuleCalendar, type CapsuleCalendarData, type CapsuleDay } from '../capsule-calendar.ts'
import { connectionDayKey, connectionStartedAt } from '../connection-day.ts'
import { timeBand, type TimeBand } from '../mate-comment.ts'
import { dayKey, duration } from '../../../shared/lib/format.ts'

/**
 * 「함께 쌓은 시간」 board (/records, 2.5D): every day is a floor tile and the day's time together stands on it as a
 * column of upright capsules — the height is the time. Pure and renderer-free (unit-tested); the WebGL scene is
 * capsule-board-scene.ts.
 *
 * Height rule: **one capsule = 30 minutes of the day's time together**, the same for every day, week, month and
 * year, so heights compare at a glance. 내 메이트 counts 10 minutes per capsule with at least 3 and at most 18 per
 * connection (`CAPSULE_COUNT`): good for a heap, but its floor of 3 makes a 5-minute and a 30-minute connection the
 * same height and its cap flattens long days, so it is not used for heights. The day total is rounded to whole
 * capsules (±15 min, the tooltip has the exact time) and shared among the day's connections (largest remainder),
 * every connection keeping at least one capsule so each connection's colour shows.
 *
 * Stacking: the capsules of a column touch — each rests in the rounded tip of the one below (`BOARD.stackStep` of a
 * length apart) and the lowest one sits on the tile. Cap: a column is at most `BOARD.maxLevels` capsules tall
 * (4 hours); a taller day keeps all its capsules but packs them into that height (`compressed`).
 *
 * Colours (user decision 2026-11-25): with 「전체」 every capsule takes its **mate's colour** (채린: the two violet
 * tones; other mates: their own hue, capsule-jar-theme.ts) and a day with several mates stacks them mate by mate; with
 * one mate chosen, the capsules take that mate's **time-band tints** (the same rule as 내 메이트).
 *
 * Grid (tile pitch 1, the same in every view, so a day keeps its place when the period changes):
 * - week: one row of 7;
 * - month: a weekday grid (rows = weeks);
 * - year: twelve month boards (each the month's weekday grid) in 4 columns × 3 rows, 2 × 6 on narrow screens.
 */

export const BOARD = {
  minutesPerCapsule: 30,
  /** Column cap in capsule heights (= 4 hours). */
  maxLevels: 8,
  /** Capsule length in tile units (tile pitch = 1). */
  capsuleLength: 0.5,
  /** Centre-to-centre distance of stacked capsules, in lengths: each rests in the tip of the one below. */
  stackStep: 0.84,
  /** How far the lowest capsule's tip sinks into the tile (lengths), so it stands on it. */
  seat: 0.06,
  /** Floor tile side and thickness (tile pitch = 1). */
  tileSize: 0.86,
  tileHeight: 0.07,
  /** Gaps between the year's month boards (tile units); the depth gap leaves room for the month label. */
  yearGapX: 1.1,
  yearGapZ: 1.8,
  /** Rows of a month board (the most weeks a month can touch). */
  monthRows: 6,
} as const

export type BoardMode = RecordRange['period']
export type BoardColorMode = 'mate' | 'band'
export type CapsuleColors = { light: string; tint: string; glow: string }

export type BoardCapsule = {
  /** `${recordId}:${piece}` */
  id: string
  recordId: string
  mateId: string
  band: TimeBand
  colors: CapsuleColors
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
  /** 0-based month of the day (the year's board it belongs to). */
  month: number
  /** World position of the tile centre (x to the right, z towards the viewer). */
  x: number
  z: number
  capsules: readonly BoardCapsule[]
  /** Height of the column's top above the tile top (0 without records). */
  height: number
  compressed: boolean
}

export type BoardLabel = {
  /** Date labels follow their tile (`tile` = its index); month labels belong to the year's boards. */
  kind: 'date' | 'month'
  key: string
  text: string
  tile: number | null
  /** Anchor: the right end of a date label, the left end of a month label (world). */
  x: number
  z: number
  size: number
  today: boolean
}

export type BoardMonth = {
  month: number
  /** `YYYY-MM` */
  key: string
  label: string
  /** World rectangle of the month board (tile edges). */
  x0: number
  z0: number
  x1: number
  z1: number
  connectionSeconds: number
  activeDays: number
  sessions: number
}

export type BoardMateLegend = { mateId: string; name: string; color: string }

export type CapsuleBoardModel = {
  mode: BoardMode
  colorMode: BoardColorMode
  /** Stable for the same days (the period's first day): a model with the same key is the same view. */
  rangeKey: string
  tiles: readonly BoardTile[]
  labels: readonly BoardLabel[]
  /** The year's month boards (empty for week and month). */
  months: readonly BoardMonth[]
  /** The 2D calendar of the same days (fallback without WebGL, keyboard order, tooltips). */
  calendar: CapsuleCalendarData
  /** Tallest column in this view. */
  maxHeight: number
  capsuleCount: number
  hasKeepsake: boolean
  /** Mates with capsules in this view, in stacking order (for the 「전체」 legend). */
  mates: readonly BoardMateLegend[]
  yearColumns: number
}

/** Whole capsules for a day's total time (at least one per connection). */
export function dayCapsuleCount(totalSeconds: number, connections: number) {
  const byTime = Math.round(Math.max(0, totalSeconds) / 60 / BOARD.minutesPerCapsule)
  return Math.max(connections, byTime, connections > 0 ? 1 : 0)
}

/**
 * Shares a day's capsules among its connections (in stacking order) by their time: largest remainder, at least one
 * each.
 */
export function capsulesPerConnection(secondsList: readonly number[]): number[] {
  const seconds = secondsList.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  if (seconds.length === 0) return []
  const total = seconds.reduce((sum, value) => sum + value, 0)
  const count = dayCapsuleCount(total, seconds.length)
  // Largest remainder over the whole count (each connection's share of the day's time) …
  const quota = seconds.map((value) => (total > 0 ? (value / total) * count : count / seconds.length))
  const result = quota.map((value) => Math.floor(value))
  let left = count - result.reduce((sum, value) => sum + value, 0)
  const byRemainder = quota
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (left <= 0) break
    result[index]! += 1
    left -= 1
  }
  // … then at least one each: a connection left at 0 takes one from the connection with the most to spare
  // (the largest count, then the one whose share is furthest below it).
  for (let index = 0; index < result.length; index++) {
    if (result[index]! > 0) continue
    let donor = -1
    for (let other = 0; other < result.length; other++) {
      if (result[other]! <= 1) continue
      if (
        donor < 0 ||
        result[other]! > result[donor]! ||
        (result[other]! === result[donor]! && result[other]! - quota[other]! > result[donor]! - quota[donor]!)
      ) {
        donor = other
      }
    }
    if (donor < 0) break
    result[donor]! -= 1
    result[index] = 1
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

export type StackOptions = {
  keepsakes?: ReadonlyMap<string, CapsuleKeepsake>
  /** Mate (theme id) of a record. */
  mateOf?: (record: StudyRecord) => string
  /** Stacking order of mates (「전체」: mate by mate); unknown mates go last. */
  mateOrder?: readonly string[]
  colorMode?: BoardColorMode
}

const paletteCache = new Map<string, CapsuleColors>()
/** Capsule colours: the mate's two tones (「전체」) or the mate's tones moved by the time band (one mate). */
export function capsuleColors(mateId: string, band: TimeBand, colorMode: BoardColorMode): CapsuleColors {
  const key = `${mateId}|${colorMode === 'band' ? band : ''}`
  let colors = paletteCache.get(key)
  if (!colors) {
    const base = capsuleJarTheme(mateId)
    const theme = colorMode === 'band' ? capsuleBandTheme(base, band) : base
    colors = { light: theme.lightHalf, tint: theme.tintHalf, glow: theme.glow }
    paletteCache.set(key, colors)
  }
  return colors
}

/** Lays out one day's column: capsules bottom → top (mate by mate, then by start), the keepsake one larger. */
export function stackDay(
  records: readonly StudyRecord[],
  { keepsakes = new Map(), mateOf = () => 'chaerin', mateOrder = [], colorMode = 'band' }: StackOptions = {},
): { capsules: BoardCapsule[]; height: number; compressed: boolean } {
  const rank = (record: StudyRecord) => {
    const index = mateOrder.indexOf(mateOf(record))
    return index < 0 ? mateOrder.length : index
  }
  const ordered = [...records].sort(
    (a, b) =>
      (colorMode === 'mate' ? rank(a) - rank(b) : 0) || connectionStartedAt(a) - connectionStartedAt(b) || a.id.localeCompare(b.id),
  )
  const counts = capsulesPerConnection(ordered.map((record) => record.studySeconds))
  const pieces: Omit<BoardCapsule, 'y'>[] = []
  ordered.forEach((record, recordIndex) => {
    const count = counts[recordIndex]!
    const band = timeBand(connectionStartedAt(record))
    const mateId = mateOf(record)
    const colors = capsuleColors(mateId, band, colorMode)
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
        mateId,
        band,
        colors,
        keepsake: isKeepsake ? keepsake!.hours : 0,
        length: BOARD.capsuleLength * (isKeepsake ? KEEPSAKE_SCALE : 1),
        roll: hash(id) * Math.PI * 2,
        glow: 0.55 + hash(`${id}|glow`) * 0.45,
      })
    }
  })
  if (pieces.length === 0) return { capsules: [], height: 0, compressed: false }
  // Centre-to-centre steps between neighbours (half of each one's nested length).
  const steps = pieces.slice(1).map((piece, index) => ((pieces[index]!.length + piece.length) / 2) * BOARD.stackStep)
  const natural = steps.reduce((sum, step) => sum + step, 0)
  const cap = (BOARD.maxLevels - 1) * BOARD.capsuleLength * BOARD.stackStep
  const compressed = natural > cap + 1e-9
  const squeeze = compressed ? cap / natural : 1
  let y = pieces[0]!.length * (0.5 - BOARD.seat)
  const capsules = pieces.map((piece, index) => {
    if (index > 0) y += steps[index - 1]! * squeeze
    return { ...piece, y }
  })
  const last = capsules[capsules.length - 1]!
  return { capsules, height: last.y + last.length / 2, compressed }
}

/** Month board slot of the year view. */
export function yearSlot(month: number, columns: number) {
  const rows = Math.ceil(12 / columns)
  const col = month % columns
  const row = Math.floor(month / columns)
  const width = 7 * columns + BOARD.yearGapX * (columns - 1)
  const depth = BOARD.monthRows * rows + BOARD.yearGapZ * (rows - 1)
  return {
    x0: col * (7 + BOARD.yearGapX) - width / 2,
    z0: row * (BOARD.monthRows + BOARD.yearGapZ) - depth / 2,
  }
}

const weekdayOf = (key: string) => (new Date(`${key}T12:00:00+09:00`).getUTCDay() + 6) % 7

/** First weekday (0 = Monday) of a month. */
function monthLead(year: number, month: number) {
  return weekdayOf(`${year}-${String(month + 1).padStart(2, '0')}-01`)
}

/**
 * World position (tile centre) of a day in a view. The month and year grids share their shape so a month board moves
 * as one piece between the two.
 */
export function boardCell(mode: BoardMode, key: string, index: number, monthRows: number, yearColumns = 4) {
  if (mode === 'week') return { x: index - 3, z: 0 }
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7)) - 1
  const slot = monthLead(year, month) + Number(key.slice(8, 10)) - 1
  const col = slot % 7
  const row = Math.floor(slot / 7)
  if (mode === 'month') return { x: col - 3, z: row - (monthRows - 1) / 2 }
  const origin = yearSlot(month, yearColumns)
  return { x: origin.x0 + col + 0.5, z: origin.z0 + row + 0.5 }
}

export type BuildBoardOptions = StackOptions & {
  yearColumns?: number
  /** Names and colours for the legend. */
  mateNames?: ReadonlyMap<string, string>
}

export function buildCapsuleBoard(
  records: readonly StudyRecord[],
  range: RecordRange,
  options: BuildBoardOptions = {},
): CapsuleBoardModel {
  const { keepsakes = new Map(), mateOf = () => 'chaerin', colorMode = 'band', yearColumns = 4 } = options
  const mateOrder = options.mateOrder ?? []
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
  const monthRows = mode === 'month' ? Math.ceil((calendar.leadingBlanks + calendar.days.length) / 7) : BOARD.monthRows
  let capsuleCount = 0
  let maxHeight = 0
  let hasKeepsake = false
  const seenMates = new Set<string>()
  const tiles = calendar.days.map((day, index): BoardTile => {
    const { x, z } = boardCell(mode, day.key, index, monthRows, yearColumns)
    const dayRecords = day.isFuture ? [] : byDay.get(day.key) ?? []
    const stack = stackDay(dayRecords, { keepsakes, mateOf, mateOrder, colorMode })
    for (const capsule of stack.capsules) {
      seenMates.add(capsule.mateId)
      if (capsule.keepsake) hasKeepsake = true
    }
    capsuleCount += stack.capsules.length
    maxHeight = Math.max(maxHeight, stack.height)
    return { index, day, month: Number(day.key.slice(5, 7)) - 1, x, z, ...stack }
  })

  const months: BoardMonth[] = []
  if (mode === 'year') {
    const year = Number(range.startDay.slice(0, 4))
    for (let month = 0; month < 12; month++) {
      const origin = yearSlot(month, yearColumns)
      const monthTiles = tiles.filter((tile) => tile.month === month)
      months.push({
        month,
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: `${month + 1}월`,
        x0: origin.x0,
        z0: origin.z0,
        x1: origin.x0 + 7,
        z1: origin.z0 + BOARD.monthRows,
        connectionSeconds: monthTiles.reduce((sum, tile) => sum + tile.day.connectionSeconds, 0),
        activeDays: monthTiles.filter((tile) => tile.day.sessions > 0).length,
        sessions: monthTiles.reduce((sum, tile) => sum + tile.day.sessions, 0),
      })
    }
  }

  const half = BOARD.tileSize / 2
  const todayMonth = range.today.slice(0, 7)
  // Dates sit at the tile's front-right corner (towards the camera) in 2.5D — never under its own column or the next
  // one — and at the top-left in 2D (the scene moves them). The year's dates show in 2D only; its month names sit in
  // front of each month board.
  const labels: BoardLabel[] = tiles.map((tile) => ({
    kind: 'date',
    key: tile.day.key,
    text: mode === 'year' ? String(Number(tile.day.key.slice(8, 10))) : tile.day.label,
    tile: tile.index,
    x: tile.x + half - 0.05,
    z: tile.z + half - 0.05,
    size: mode === 'week' ? 0.24 : 0.22,
    today: tile.day.isToday,
  }))
  for (const month of months) {
    labels.push({
      kind: 'month',
      key: month.key,
      text: month.label,
      tile: null,
      x: month.x0 + 0.1,
      z: month.z1 + 0.2,
      size: 0.95,
      today: month.key === todayMonth,
    })
  }

  const mates = [...seenMates]
    .sort((a, b) => {
      const ra = mateOrder.indexOf(a)
      const rb = mateOrder.indexOf(b)
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
    })
    .map((mateId) => ({ mateId, name: options.mateNames?.get(mateId) ?? mateId, color: capsuleJarTheme(mateId).tintHalfShade }))

  return {
    mode,
    colorMode,
    rangeKey: `${mode}|${range.startDay}`,
    tiles,
    labels,
    months,
    calendar,
    maxHeight,
    capsuleCount,
    hasKeepsake,
    mates,
    yearColumns,
  }
}

/** A year month board can be opened once it has begun (its first day is not in the future). */
export function isMonthSelectable(model: Pick<CapsuleBoardModel, 'tiles'>, month: number) {
  const first = model.tiles.find((tile) => tile.month === month)
  return Boolean(first && !first.day.isFuture)
}

/** Tooltip / label of a year month board. */
export function boardMonthTooltip(month: BoardMonth) {
  if (month.sessions === 0) return `${month.label} · 기록 없음`
  return `${month.label} · 함께한 시간 ${duration(month.connectionSeconds)} · ${month.activeDays}일 · 눌러서 크게 보기`
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

/** Period offset (the page's `offset`) whose range contains a day, for switching periods around the same days. */
export function offsetContaining(period: BoardMode, key: string, today: string) {
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7))
  if (period === 'year') return year - todayYear
  if (period === 'month') return (year - todayYear) * 12 + (month - todayMonth)
  const mondayOf = (value: string) => Date.parse(`${value}T00:00:00+09:00`) - weekdayOf(value) * 86_400_000
  return Math.round((mondayOf(key) - mondayOf(today)) / (7 * 86_400_000))
}

export { dayKey }
