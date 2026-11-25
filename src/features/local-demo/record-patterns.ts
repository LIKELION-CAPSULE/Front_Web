/**
 * Local dummy (`VITE_DATA_SOURCE=mock`) record patterns for QA of the records page.
 * Dates are always generated relative to "today" in Seoul, so the current week/month/year never goes stale.
 * Development only: imported by the local demo store, which production never loads.
 */

export const recordPatterns = ['steady', 'light', 'returning', 'night', 'long', 'firstWeek', 'stress', 'none'] as const
export type RecordPattern = (typeof recordPatterns)[number]

export const recordPatternLabels: Record<RecordPattern, string> = {
  steady: '이번 주 꾸준함(5일 이상)',
  light: '이번 주 1~2번',
  returning: '이번 주 0번(지난주는 있음)',
  night: '밤에 주로 만남',
  long: '한 번에 오래(2시간 이상)',
  firstWeek: '처음 시작한 주',
  stress: '올해 매일(성능 측정용)',
  none: '기록 없음',
}

export function isRecordPattern(value: unknown): value is RecordPattern {
  return typeof value === 'string' && (recordPatterns as readonly string[]).includes(value)
}

export type PatternSession = { id: number; startedAt: number; endedAt: number; seconds: number }

const DAY = 86_400_000
const SEOUL_OFFSET = 9 * 3_600_000
/** Generated ids live far above locally finished sessions (992001+) and change whenever a slot's time changes. */
export const PATTERN_ID_BASE = 900_000_000

/** [days ago, start "HH:MM" in Seoul, minutes] */
type Slot = readonly [daysAgo: number, start: string, minutes: number]

function seoulToday(now: number) {
  const shifted = new Date(now + SEOUL_OFFSET)
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SEOUL_OFFSET
  /** 0 = Monday … 6 = Sunday, the same week start as the records page. */
  const weekday = (shifted.getUTCDay() + 6) % 7
  return { midnight, weekday }
}

function slots(pattern: RecordPattern, weekday: number, dayOfYear: number): Slot[] {
  const w = weekday
  const evening = ['19:00', '19:40', '20:10', '18:30', '20:40', '19:20', '18:50']
  const minutes = [40, 55, 70, 85, 100, 65, 45]
  switch (pattern) {
    case 'steady': {
      // Every day for ~two weeks (one gap), today in the morning so it is usually already over. The starts cover all
      // five time bands (my-mates capsules are tinted by band), with night and dawn well under the 「late」 share.
      const mixed = ['19:00', '13:30', '20:10', '05:40', '20:40', '22:10', '09:20']
      const list: Slot[] = [[0, '07:10', 50]]
      for (let d = 1; d <= 12; d++) if (d !== 9) list.push([d, mixed[d % 7]!, minutes[d % 7]!])
      return list
    }
    case 'light': {
      // This week: 1–2 connections, never on consecutive days with last week (keeps the streak short).
      const list: Slot[] = w === 0 ? [[0, '07:30', 50]] : [[1, '20:00', 75]]
      if (w >= 3) list.push([3, '19:30', 50])
      for (const d of [w + 2, w + 4, w + 6, w + 9]) list.push([d, evening[d % 7]!, minutes[d % 7]!])
      return list
    }
    case 'returning':
      // Nothing this week; three times last week and some before.
      return [w + 2, w + 3, w + 5, w + 9, w + 11].map((d) => [d, evening[d % 7]!, minutes[d % 7]!] as const)
    case 'night': {
      // Every other day of this week, late at night and again at dawn (00:40 of the next calendar day, which is still
      // the same day from 05:00 — the server's day rule); last week twice in the evening.
      const list: Slot[] = []
      for (let d = w; d >= 0; d -= 2) {
        list.push([d, '22:00', 70])
        if (d >= 1) list.push([d - 1, '00:40', 50])
      }
      list.push([w + 2, '19:30', 60], [w + 4, '20:00', 45])
      return list
    }
    case 'long':
      // Long sessions this week (2h30, 3h10), shorter ones last week.
      return [
        [w, '09:30', 150],
        ...(w >= 2 ? [[w - 2, '14:00', 190] as const] : []),
        [w + 2, '19:30', 60],
        [w + 4, '20:00', 45],
        [w + 6, '19:00', 50],
      ]
    case 'firstWeek':
      // No history before this week's Monday.
      return [[w, '20:00', 50], ...(w >= 1 ? [[0, '07:40', 35] as const] : []), ...(w >= 3 ? [[w - 2, '19:30', 40] as const] : [])]
    case 'stress': {
      // Every day of the year so far: 1–3 connections of 20–150 minutes in every time band (board performance).
      const starts = ['01:10', '07:20', '13:30', '19:10', '22:20']
      const list: Slot[] = []
      let seed = 7
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 4294967296
      }
      for (let d = 1; d <= dayOfYear; d++) {
        const count = 1 + Math.floor(random() * 3)
        const used = new Set<string>()
        for (let index = 0; index < count; index++) {
          const start = starts[Math.floor(random() * starts.length)]!
          if (used.has(start)) continue
          used.add(start)
          list.push([d, start, 20 + Math.floor(random() * 130)])
        }
      }
      return list
    }
    case 'none':
      return []
  }
}

function slotId(pattern: RecordPattern, startedAt: number) {
  let hash = 0x811c9dc5
  for (const char of `${pattern}|${startedAt}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return PATTERN_ID_BASE + ((hash >>> 0) % 90_000_000)
}

/** Sessions for the pattern, newest first. Slots that have not finished yet are left out. */
export function patternSessions(pattern: RecordPattern, now: number): PatternSession[] {
  const { midnight, weekday } = seoulToday(now)
  const shifted = new Date(now + SEOUL_OFFSET)
  const dayOfYear = Math.floor((midnight + SEOUL_OFFSET - Date.UTC(shifted.getUTCFullYear(), 0, 1)) / DAY)
  return slots(pattern, weekday, dayOfYear)
    .map(([daysAgo, start, minutes]) => {
      const [hour, minute] = start.split(':').map(Number) as [number, number]
      const startedAt = midnight - daysAgo * DAY + (hour * 60 + minute) * 60_000
      return { id: slotId(pattern, startedAt), startedAt, endedAt: startedAt + minutes * 60_000, seconds: minutes * 60 }
    })
    .filter((session) => session.endedAt <= now)
    .sort((a, b) => b.endedAt - a.endedAt)
}

/** Ids generated by a pattern, or by the previous fixed fixture (991001–991014). */
export function isPatternRecordId(id: string) {
  const value = Number(id)
  return value >= PATTERN_ID_BASE || (value > 991_000 && value < 991_100)
}
