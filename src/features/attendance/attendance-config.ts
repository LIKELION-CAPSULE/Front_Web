/** Everything tunable about attendance: the cycle, its rewards and 채린's lines on the home path. */

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
