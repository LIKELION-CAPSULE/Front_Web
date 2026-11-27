import {
  type AttendanceCounting,
  ASSET_SIZE, ATTENDANCE_COUNTING, ATTENDANCE_LAYOUTS, COMPACT_BELOW_SCALE, CYCLE_DAYS, DAILY_ATTENDANCE_CREDIT, DEFAULT_REWARDS, MAX_SCALE, PLATFORM_FEET_RATIO,
  POSE_OFFSET, SLOTS_PER_PAGE, SOURCE_MARGIN, type AttendanceLayout,
} from './attendance-config.ts'

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
export type SlotStatus = 'done' | 'today' | 'upcoming'
export type CharacterPose = 'idle' | 'jump' | 'cheer'

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

/** Index (0–5) of the slot the character stands on, or -1 for the floor before day 1. */
export const characterSlot = (cycleDay: number) => cycleDay - 1
/**
 * Pages show `visible` slots side by side. The last page is pulled back so it is always full: with four visible,
 * the pages are days 1–4 and 3–6. Returns the first slot index a page shows.
 */
export const pageStart = (page: number, visible: number = SLOTS_PER_PAGE) => Math.max(0, Math.min(page * visible, CYCLE_DAYS - visible))
export const pageCount = (visible: number = SLOTS_PER_PAGE) => Math.ceil(CYCLE_DAYS / visible)
/** The page that holds the character, which is also the page to show on load. */
export function pageFor(cycleDay: number, visible: number = SLOTS_PER_PAGE) {
  const index = cycleDay - 1
  for (let page = 0; page < pageCount(visible); page++) {
    if (index < pageStart(page, visible) + visible) return page
  }
  return pageCount(visible) - 1
}

export function slotStatus(index: number, state: Pick<AttendanceState, 'cycleDay' | 'checkedToday'>): SlotStatus {
  if (index < state.cycleDay) return 'done'
  return index === state.cycleDay && !state.checkedToday ? 'today' : 'upcoming'
}

/** Whole-pixel display size for a source image scaled to `width` (or to `height` when given instead). */
export function displaySize(source: { width: number; height: number }, size: { width?: number; height?: number }) {
  const scale = size.width !== undefined ? size.width / source.width : (size.height ?? source.height) / source.height
  return { width: Math.round(source.width * scale), height: Math.round(source.height * scale), scale }
}

/** One scale for every pose so the character keeps its size when poses change; based on the idle height. */
export function characterScale(layout: AttendanceLayout) {
  return layout.characterHeight / ASSET_SIZE.idle.height
}

export function poseSize(pose: CharacterPose, layout: AttendanceLayout) {
  const scale = characterScale(layout)
  const source = ASSET_SIZE[pose]
  return { width: Math.round(source.width * scale), height: Math.round(source.height * scale) }
}

/** Geometry of one slot column inside the track, in display pixels. */
export function slotGeometry(layout: AttendanceLayout) {
  const platform = displaySize(ASSET_SIZE.platform, { width: layout.platformWidth })
  const labelTop = layout.trackHeight - layout.labelHeight
  const platformTop = labelTop - layout.labelGap - platform.height
  const floorY = Math.round(platformTop + platform.height * PLATFORM_FEET_RATIO)
  return { platform, labelTop, platformTop, floorY }
}

/** Horizontal centre of slot `index` (0–5) inside the track. */
export const slotCenter = (index: number, layout: AttendanceLayout) => layout.insetLeft + layout.pitch * index + layout.pitch / 2

/**
 * Where the character's feet go for a slot index (-1 = the floor before day 1), as the top-left translate of the
 * idle image inside the track. The image's own bottom margin is pushed below the platform face.
 */
export function characterSpot(index: number, layout: AttendanceLayout, pose: CharacterPose = 'idle') {
  const { floorY } = slotGeometry(layout)
  const size = poseSize(pose, layout)
  const margin = Math.round(SOURCE_MARGIN * characterScale(layout))
  const onFloor = index < 0
  const centerX = onFloor ? slotCenter(0, layout) + layout.floorSpotX : slotCenter(index, layout) + layout.characterOnSlotX
  const feetY = onFloor ? floorY + layout.floorSpotDrop : floorY
  return {
    x: Math.round(centerX - size.width / 2 + POSE_OFFSET[pose].x),
    y: Math.round(feetY - size.height + margin + POSE_OFFSET[pose].y),
  }
}

/** Track offset that brings `page` into view. */
export const pageOffset = (page: number, layout: AttendanceLayout, visible: number = SLOTS_PER_PAGE) =>
  -pageStart(page, visible) * layout.pitch

/** Visible track width: `visible` slots plus the side insets. */
export const viewportWidth = (layout: AttendanceLayout, visible: number = SLOTS_PER_PAGE) =>
  layout.insetLeft + layout.pitch * visible + layout.insetRight

/** Every size in `layout` multiplied by `scale`, kept in whole pixels. */
export function scaleLayout(layout: AttendanceLayout, scale: number): AttendanceLayout {
  const scaled = { ...layout }
  for (const key of Object.keys(scaled) as (keyof AttendanceLayout)[]) {
    scaled[key] = key === 'scale' ? layout.scale * scale : Math.round(layout[key] * scale)
  }
  return scaled
}

/**
 * The layout for a widget `width` pixels wide: the regular set scaled to fill it (in 5% steps so small resizes do
 * not re-lay everything), or the compact set on tablets and in narrow spaces.
 */
export function fitLayout(width: number, tablet: boolean): AttendanceLayout {
  if (tablet) return ATTENDANCE_LAYOUTS.compact
  if (!width) return ATTENDANCE_LAYOUTS.regular
  const fit = width / viewportWidth(ATTENDANCE_LAYOUTS.regular)
  if (fit < COMPACT_BELOW_SCALE) return ATTENDANCE_LAYOUTS.compact
  const scale = Math.min(MAX_SCALE, Math.floor(fit * 20) / 20)
  return scale === 1 ? ATTENDANCE_LAYOUTS.regular : scaleLayout(ATTENDANCE_LAYOUTS.regular, scale)
}
