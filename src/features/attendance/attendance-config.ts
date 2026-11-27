/**
 * Everything tunable about the attendance widget: rewards, sizes, positions and timings.
 * Sizes are whole CSS pixels; positions are measured from the top-left of a slot column unless noted.
 */

/**
 * The attendance rules still open (user, 2026-11-27: the beta runs 14 days; 7 days twice or 14 once, and how missed
 * days count, are decided later). Change them here only:
 * - `CYCLE_DAYS`: days in one cycle (the home path's art has 7 pads; a 14-day cycle needs new art or two laps).
 * - `ATTENDANCE_COUNTING`: `'cumulative'` (the mock rule: missing a day changes nothing, progress waits) or
 *   `'consecutive'` (a missed day starts the cycle again from day 1).
 * The `credits` source counts the cycle from 34 with these (attendance-model.ts `attendanceFromDays`); with the
 * attendance API the server counts it (the local mock with these).
 */
export const CYCLE_DAYS = 7
export type AttendanceCounting = 'cumulative' | 'consecutive'
export const ATTENDANCE_COUNTING: AttendanceCounting = 'cumulative'
/** Days shown side by side by default; a widget can show more (see `visibleSlots`). */
export const SLOTS_PER_PAGE = 3

/** Every day's attendance reward (docs/BACKEND_API.md 4.5; user decision 2026-11-27): 1,500, the same each day. */
export const DAILY_ATTENDANCE_CREDIT = 1500

/**
 * The cycle's days. The reward is the same every day; days 3 and 7 (the reward capsule at the end of the path) stay
 * milestones for the path's decoration only — no different amount is ever shown for them.
 */
export const DEFAULT_REWARDS = [
  { day: 1, credit: DAILY_ATTENDANCE_CREDIT, milestone: false },
  { day: 2, credit: DAILY_ATTENDANCE_CREDIT, milestone: false },
  { day: 3, credit: DAILY_ATTENDANCE_CREDIT, milestone: true },
  { day: 4, credit: DAILY_ATTENDANCE_CREDIT, milestone: false },
  { day: 5, credit: DAILY_ATTENDANCE_CREDIT, milestone: false },
  { day: 6, credit: DAILY_ATTENDANCE_CREDIT, milestone: false },
  { day: 7, credit: DAILY_ATTENDANCE_CREDIT, milestone: true },
] as const

export const ATTENDANCE_COPY = {
  title: '출석 보상',
  dayLabel: (day: number) => `${day}일차`,
  status: { done: '완료', today: '오늘', upcoming: '예정' },
  reward: (credit: number) => `+${credit.toLocaleString('ko-KR')} 크레딧`,
  pageLabel: (first: number, last: number) => `${first}~${last}일차 보기`,
} as const

/** What 채린 says on the home attendance path: one line per day reached, and two while today is still open. */
export const ATTENDANCE_PATH_LINES = {
  speaker: '채린',
  days: [
    '안녕! 앞으로 잘 부탁해!',
    '오늘도 와 줬네? 반가워!',
    '벌써 3일째야. 이제 좀 익숙해졌지?',
    '우리 꽤 오래 봤다?',
    '네가 오는 시간, 이제 기다려지더라.',
    '내일이면 일주일이야. 꼭 와야 해!',
    '일주일 내내 와 줬구나! 오늘도 1,500 크레딧, 캡슐에 담아 줄게.',
  ],
  /** Before the first check-in of the week. */
  start: '안녕! 오늘 출석하면 첫 발판으로 갈 수 있어.',
  /** A day already reached, today not checked in yet. */
  waiting: '왔구나! 오늘도 출석하고 한 칸 더 가 보자.',
} as const

/**
 * Two base size sets: `regular` beside the banner copy, scaled up to fill about half the banner, and `compact` for
 * tablets where the widget sits under the copy. `scale` is applied on top of these by `fitLayout`.
 */
export type AttendanceLayout = {
  scale: number
  pitch: number
  insetLeft: number
  insetRight: number
  trackHeight: number
  labelHeight: number
  labelGap: number
  platformWidth: number
  capsuleHeight: number
  capsuleTop: number
  coinWidth: number
  badgeWidth: number
  characterHeight: number
  characterOnSlotX: number
  coinBesideCharacterX: number
  floorSpotX: number
  floorSpotDrop: number
  jumpHeight: number
}

export const ATTENDANCE_LAYOUTS = {
  regular: {
    scale: 1,
    pitch: 140,
    /** Room left of day 1 where the character waits before the first check-in. */
    insetLeft: 64,
    insetRight: 16,
    trackHeight: 318,
    labelHeight: 38,
    labelGap: 6,
    platformWidth: 130,
    capsuleHeight: 56,
    capsuleTop: 26,
    coinWidth: 80,
    badgeWidth: 84,
    characterHeight: 150,
    /** The character stands a little left of centre on its platform so the coin beside it stays visible. */
    characterOnSlotX: -26,
    coinBesideCharacterX: 38,
    /** Where the character waits before day 1, from day 1's centre, and how far below the platform face. */
    floorSpotX: -92,
    floorSpotDrop: 22,
    jumpHeight: 70,
  },
  compact: {
    scale: 0.8,
    pitch: 112,
    insetLeft: 52,
    insetRight: 12,
    trackHeight: 264,
    labelHeight: 34,
    labelGap: 4,
    platformWidth: 104,
    capsuleHeight: 46,
    capsuleTop: 20,
    coinWidth: 64,
    badgeWidth: 68,
    characterHeight: 122,
    characterOnSlotX: -21,
    coinBesideCharacterX: 30,
    floorSpotX: -74,
    floorSpotDrop: 18,
    jumpHeight: 56,
  },
} as const satisfies Record<string, AttendanceLayout>

/** The regular set grows with the room it has, up to this much, so it fills about half the banner. */
export const MAX_SCALE = 1.4
/** Below this share of the regular width the compact set is used instead. */
export const COMPACT_BELOW_SCALE = 0.98
/** Tablet and below, where the widget sits under the banner copy with smaller slots. */
export const COMPACT_MEDIA = '(max-width: 1024px)'

/** Source image sizes (transparent PNGs with an ~8px clear margin on every side). */
export const ASSET_SIZE = {
  idle: { width: 428, height: 668 },
  jump: { width: 467, height: 572 },
  cheer: { width: 439, height: 654 },
  capsule: { width: 273, height: 362 },
  platform: { width: 435, height: 220 },
  coin: { width: 275, height: 262 },
  badge: { width: 337, height: 303 },
} as const
/** Where on the platform image its top face reads as "the floor" (0 top edge, 1 bottom edge). */
export const PLATFORM_FEET_RATIO = 0.4
/** Clear margin baked into the bottom of every source image, in source pixels. */
export const SOURCE_MARGIN = 8

/** Fine offsets per pose (display pixels) so the planted foot stays put when poses cross-fade. */
export const POSE_OFFSET = {
  idle: { x: 0, y: 0 },
  jump: { x: 0, y: 0 },
  cheer: { x: 12, y: 0 },
} as const

/** Check-in sequence timings in milliseconds. Each beat starts 50–100ms before the previous one ends. */
export const MOTION = {
  crouch: 120,
  poseFade: 80,
  jump: 520,
  jumpStart: 90,
  pageSlide: 650,
  ring: 500,
  capsuleBurst: 400,
  coinDelay: 300,
  shine: 600,
  rewardDelay: 520,
  rewardFlight: 720,
  countUp: 600,
  cheer: 800,
  rays: 1200,
  confettiDelay: 600,
  confetti: 2500,
  /** Time to let the page scroll the widget into view when the check-in starts elsewhere. */
  scrollIntoView: 450,
  /** Reduced motion: every change is a short fade. */
  reducedFade: 200,
} as const

export const PAGE_EASE = [0.22, 1, 0.36, 1] as const
