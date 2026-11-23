/**
 * Everything tunable about the attendance widget: rewards, sizes, positions and timings.
 * Sizes are whole CSS pixels; positions are measured from the top-left of a slot column unless noted.
 */

export const CYCLE_DAYS = 6
/** Days shown side by side by default; a widget can show more (see `visibleSlots`). */
export const SLOTS_PER_PAGE = 3

/** Mock rewards until the server sends its own. Days 3 and 6 are milestones. */
export const DEFAULT_REWARDS = [
  { day: 1, credit: 300, milestone: false },
  { day: 2, credit: 100, milestone: false },
  { day: 3, credit: 500, milestone: true },
  { day: 4, credit: 100, milestone: false },
  { day: 5, credit: 700, milestone: false },
  { day: 6, credit: 100, milestone: true },
] as const

export const ATTENDANCE_COPY = {
  title: '출석 보상',
  dayLabel: (day: number) => `${day}일차`,
  status: { done: '완료', today: '오늘', upcoming: '예정' },
  reward: (credit: number) => `+${credit.toLocaleString('ko-KR')} 크레딧`,
  pageLabel: (first: number, last: number) => `${first}~${last}일차 보기`,
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
