import type { StudyRecord } from '../demo/types.ts'
import { dayKey, duration } from '../../shared/lib/format.ts'
import { withParticle } from '../../shared/lib/korean.ts'
import { getRecordRange, periodDays, recordsInRange, type RecordRange } from '../reports/record-period.ts'
import { completedRecords, connectionDayKey, connectionStartedAt } from './connection-day.ts'

/**
 * Rule-based "mate's comment" for the records page.
 *
 * Every sentence is assembled only from facts computed here (counts, days, connection time, time of day,
 * comparison with the previous period, streak, first period). Templates never invent anything the records
 * do not contain. Dates follow records/connection-day.ts: a connection belongs to the day (and time of day) it
 * started, and only connections that have ended by `now` count. The template is picked from a seed (account + mate + period start), so the same period
 * with the same data always shows the same sentence.
 */

const DAY = 86_400_000
const SEOUL_OFFSET = 9 * 3_600_000
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

export type TimeBand = 'dawn' | 'morning' | 'day' | 'evening' | 'night'
export const timeBandLabels: Record<TimeBand, string> = {
  dawn: '새벽',
  morning: '아침',
  day: '낮',
  evening: '저녁',
  night: '밤',
}

/** Seoul hour → time band. 새벽 0–5 · 아침 5–11 · 낮 11–17 · 저녁 17–21 · 밤 21–24. */
export function timeBand(timestamp: number): TimeBand {
  const hour = new Date(timestamp + SEOUL_OFFSET).getUTCHours()
  if (hour < 5) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 17) return 'day'
  if (hour < 21) return 'evening'
  return 'night'
}

export const mateCommentKinds = [
  'firstMeet', // no record with this mate at all
  'missed', // current period is empty, but there were records before
  'firstPeriod', // this period is the very first one with records
  'long', // one connection lasted 2 hours or more
  'steady', // came (almost) every day
  'late', // mostly met at night / dawn
  'more', // more connections than the previous period
  'light', // only 1–2 connections this week
  'less', // fewer connections than the previous period
  'regular', // anything else
] as const
export type MateCommentKind = (typeof mateCommentKinds)[number]

export const LONG_SESSION_SECONDS = 2 * 3600

export type PeriodFacts = {
  period: RecordRange['period']
  /** The displayed period contains today. */
  isCurrent: boolean
  /** "이번 주", "지난주", "그 주", "이번 달", "올해" … */
  periodWord: string
  /** The period right before: "지난주", "그 전 주" … */
  previousWord: string
  sessions: number
  activeDays: number
  /** Connection time (the value always available, also without camera). */
  totalSeconds: number
  /** Days of the period that have already started (whole period for past periods). */
  elapsedDays: number
  longest: { seconds: number; dayLabel: string; band: TimeBand; dayKey: string } | null
  longSessions: number
  dominantBand: { band: TimeBand; count: number; share: number } | null
  /** Sessions whose start fell at night or dawn (both together: "늦은 시간"). */
  lateSessions: number
  /** The late band with more sessions (night on a tie); null without late sessions. */
  lateBand: TimeBand | null
  /** Sessions in `lateBand` only. */
  lateBandSessions: number
  /** Late sessions fell both at night and at dawn: speak of "늦은 시간", not of one band. */
  lateMixed: boolean
  previousSessions: number
  /** Consecutive days with a record, ending today/yesterday (current) or on the last active day (past). */
  streakDays: number
  /** Records exist in this period and none before it. */
  isFirstPeriod: boolean
  hasRecordsBefore: boolean
  /** Days since the last record before this period (only when the period itself is empty). */
  lastSeenDaysAgo: number | null
  /** Days (`YYYY-MM-DD`, ascending, inside the period) the facts above come from — what a line can point at. */
  keys: {
    active: string[]
    /** The streak's days, oldest first (inside the period). */
    streak: string[]
    late: string[]
    lateBand: string[]
    dominantBand: string[]
    long: string[]
    first: string[]
  }
}

export type MateCommentInput = {
  /** Displayed period. */
  range: RecordRange
  /** 0 = current period, -1 = previous … (same as the page's `offset`). */
  offset: number
  now: number
  /** Every record with the speaking mate, any date. */
  records: readonly StudyRecord[]
  /** Stable per account + mate. The period start is appended internally. */
  seedKey: string
  /** Mate voice; defaults to the shared friendly voice. */
  voice?: MateVoice
}

/**
 * What a line speaks about, so the board can light the same days while the line types (records page): a day
 * (`longest`, `first`), the days of a streak joined by a line of light (`streak`, `allDays`), or a set of days.
 */
export type CommentFocus = 'none' | 'longest' | 'first' | 'streak' | 'allDays' | 'active' | 'late' | 'lateBand' | 'band' | 'long'
export type CommentHighlight = { days: string[]; streak: string[] }
export type MateComment = { kind: MateCommentKind; text: string; focus: CommentFocus; highlight: CommentHighlight }

const dayStart = (key: string) => Date.parse(`${key}T00:00:00+09:00`)

function dayLabel(timestamp: number, period: RecordRange['period']) {
  const shifted = new Date(timestamp + SEOUL_OFFSET)
  return period === 'week'
    ? `${WEEKDAY_NAMES[shifted.getUTCDay()]}요일`
    : `${shifted.getUTCMonth() + 1}월 ${shifted.getUTCDate()}일`
}

function periodWords(period: RecordRange['period'], offset: number) {
  const words = {
    week: ['이번 주', '지난주', '그 주', '그 전 주'],
    month: ['이번 달', '지난달', '그 달', '그 전 달'],
    year: ['올해', '작년', '그해', '그 전 해'],
  }[period]
  const periodWord = (offset === 0 ? words[0] : offset === -1 ? words[1] : words[2])!
  const previousWord = (offset === 0 ? words[1] : words[3])!
  return { periodWord, previousWord }
}

function streakEndingAt(days: ReadonlySet<string>, anchorKey: string) {
  let count = 0
  let cursor = dayStart(anchorKey)
  while (days.has(dayKey(cursor))) {
    count++
    cursor -= DAY
  }
  return count
}

export function collectPeriodFacts(input: Omit<MateCommentInput, 'seedKey' | 'voice'>): PeriodFacts {
  const { range, offset, now } = input
  const records = completedRecords(input.records, now)
  const isCurrent = offset === 0
  const inRange = recordsInRange(records, range)
  const previous = recordsInRange(records, getRecordRange(range.period, now, offset - 1))
  const { periodWord, previousWord } = periodWords(range.period, offset)

  const activeDays = new Set(inRange.map(connectionDayKey)).size
  const totalSeconds = inRange.reduce((sum, record) => sum + record.studySeconds, 0)
  const days = periodDays(range)
  const elapsedDays = isCurrent ? days.filter((key) => key <= range.today).length : days.length

  let longestRecord: StudyRecord | null = null
  for (const record of inRange) {
    if (!longestRecord || record.studySeconds > longestRecord.studySeconds) longestRecord = record
  }
  const longest = longestRecord
    ? {
        seconds: longestRecord.studySeconds,
        dayLabel: dayLabel(connectionStartedAt(longestRecord), range.period),
        band: timeBand(connectionStartedAt(longestRecord)),
        dayKey: connectionDayKey(longestRecord),
      }
    : null

  const bandCounts = new Map<TimeBand, number>()
  for (const record of inRange) {
    const band = timeBand(connectionStartedAt(record))
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1)
  }
  let dominantBand: PeriodFacts['dominantBand'] = null
  for (const [band, count] of bandCounts) {
    if (!dominantBand || count > dominantBand.count) dominantBand = { band, count, share: count / inRange.length }
  }
  const nightCount = bandCounts.get('night') ?? 0
  const dawnCount = bandCounts.get('dawn') ?? 0
  const lateSessions = nightCount + dawnCount
  const lateBand: TimeBand | null = lateSessions === 0 ? null : nightCount >= dawnCount ? 'night' : 'dawn'
  const lateBandSessions = lateBand === 'night' ? nightCount : lateBand === 'dawn' ? dawnCount : 0
  const lateMixed = nightCount > 0 && dawnCount > 0

  const before = records.filter((record) => connectionStartedAt(record) < range.start)
  const hasRecordsBefore = before.length > 0

  const activeKeys = new Set(
    records.filter((record) => connectionStartedAt(record) < Math.min(range.end, now + 1)).map(connectionDayKey),
  )
  let streakDays = 0
  if (isCurrent) {
    const yesterday = dayKey(dayStart(range.today) - DAY)
    streakDays = activeKeys.has(range.today) ? streakEndingAt(activeKeys, range.today) : streakEndingAt(activeKeys, yesterday)
  } else if (inRange.length > 0) {
    streakDays = streakEndingAt(activeKeys, connectionDayKey(inRange[0]!))
  }

  const inPeriod = (key: string) => key >= range.startDay && key <= range.endDay
  const daysOf = (list: readonly StudyRecord[]) => [...new Set(list.map(connectionDayKey))].sort()
  const streakKeys: string[] = []
  if (streakDays > 0) {
    const anchor = isCurrent
      ? activeKeys.has(range.today)
        ? range.today
        : dayKey(dayStart(range.today) - DAY)
      : connectionDayKey(inRange[0]!)
    for (let index = streakDays - 1; index >= 0; index--) {
      const key = dayKey(dayStart(anchor) - index * DAY)
      if (inPeriod(key)) streakKeys.push(key)
    }
  }
  const bandOf = (record: StudyRecord) => timeBand(connectionStartedAt(record))
  const activeList = daysOf(inRange)
  const keys = {
    active: activeList,
    streak: streakKeys,
    late: daysOf(inRange.filter((record) => bandOf(record) === 'night' || bandOf(record) === 'dawn')),
    lateBand: lateBand ? daysOf(inRange.filter((record) => bandOf(record) === lateBand)) : [],
    dominantBand: dominantBand ? daysOf(inRange.filter((record) => bandOf(record) === dominantBand!.band)) : [],
    long: daysOf(inRange.filter((record) => record.studySeconds >= LONG_SESSION_SECONDS)),
    first: activeList.slice(0, 1),
  }

  let lastSeenDaysAgo: number | null = null
  if (inRange.length === 0 && hasRecordsBefore) {
    const last = Math.max(...before.map(connectionStartedAt))
    lastSeenDaysAgo = Math.round((dayStart(range.today) - dayStart(dayKey(last))) / DAY)
  }

  return {
    period: range.period,
    isCurrent,
    periodWord,
    previousWord,
    sessions: inRange.length,
    activeDays,
    totalSeconds,
    elapsedDays,
    longest,
    longSessions: inRange.filter((record) => record.studySeconds >= LONG_SESSION_SECONDS).length,
    dominantBand,
    lateSessions,
    lateBand,
    lateBandSessions,
    lateMixed,
    previousSessions: previous.length,
    streakDays,
    isFirstPeriod: inRange.length > 0 && !hasRecordsBefore,
    hasRecordsBefore,
    lastSeenDaysAgo,
    keys,
  }
}

function isSteady(facts: PeriodFacts) {
  const { period, activeDays, elapsedDays, streakDays, isCurrent } = facts
  const everyDay = activeDays === elapsedDays && elapsedDays >= 2
  if (period === 'week') return activeDays >= 5 || everyDay || (isCurrent && streakDays >= 5)
  if (period === 'month') return activeDays >= 12 || (everyDay && elapsedDays >= 3) || (isCurrent && streakDays >= 7)
  return activeDays >= 60 || (isCurrent && streakDays >= 7)
}

/** Situation for the period. Returns null when the page should not show a comment. */
export function classifyPeriod(facts: PeriodFacts): MateCommentKind | null {
  if (facts.sessions === 0) {
    if (!facts.hasRecordsBefore) return facts.isCurrent ? 'firstMeet' : null
    return facts.isCurrent ? 'missed' : null
  }
  if (facts.isFirstPeriod && facts.period !== 'year') return 'firstPeriod'
  if (facts.longSessions > 0) return 'long'
  if (isSteady(facts)) return 'steady'
  if (facts.sessions >= 2 && facts.lateSessions / facts.sessions >= 0.6) return 'late'
  if (facts.previousSessions > 0 && facts.sessions > facts.previousSessions) return 'more'
  if (facts.period === 'week' && facts.sessions <= 2) return 'light'
  if (facts.previousSessions > facts.sessions) return 'less'
  return 'regular'
}

// ---------------------------------------------------------------------------------------------------------------
// Voice: sentence templates per situation. A template returns null when its facts do not apply.

const NATIVE_COUNTS = ['', '한', '두', '세', '네'] as const
/** "한 번", "두 번", … "5번" */
export function times(count: number) {
  return count >= 1 && count <= 4 ? `${NATIVE_COUNTS[count]} 번` : `${count}번`
}

const NATIVE_DAYS = ['', '하루', '이틀'] as const
/** "하루", "이틀", "3일" */
export function days(count: number) {
  return count >= 1 && count <= 2 ? NATIVE_DAYS[count]! : `${count}일`
}

export type CommentContext = PeriodFacts & {
  /** Period with its topic particle: "이번 주는", "이번 달은". */
  periodTopic: string
  total: string
  longestDuration: string
  /** Present or past form depending on whether the period is the current one. */
  tense: (present: string, past: string) => string
}

/** A line, optionally with what it speaks about (`none` when it is a plain string). */
export type CommentLine = string | { text: string; focus: CommentFocus }
export type CommentTemplate = (context: CommentContext) => CommentLine | null
const about = (focus: CommentFocus, text: string): CommentLine => ({ text, focus })

/** Night and dawn together are "늦은 시간"; a single band is named. */
const lateWord = (c: CommentContext) => (c.lateMixed || !c.lateBand ? '늦은 시간' : timeBandLabels[c.lateBand])
export type MateVoice = { id: string; templates: Readonly<Record<MateCommentKind, readonly CommentTemplate[]>> }

/** Default friendly 반말 voice (Chaerin). Other mates can register their own voice with the same kinds. */
export const chaerinVoice: MateVoice = {
  id: 'chaerin',
  templates: {
    firstMeet: [
      () => '우리 아직 같이 있어 본 적 없지? 오늘 한번 만나 볼래?',
      () => '기록이 아직 텅 비었어. 첫 캡슐, 나랑 같이 채워 볼래?',
      () => '여기 아직 아무것도 없네. 첫 만남 기다리고 있을게!',
    ],
    missed: [
      (c) => (c.previousSessions > 0 ? `${c.periodWord}엔 아직 못 만났네. ${c.previousWord}엔 ${times(c.previousSessions)} 왔었잖아, 보고 싶었어!` : null),
      (c) => (c.lastSeenDaysAgo !== null && c.lastSeenDaysAgo >= 2 ? `마지막으로 본 게 ${days(c.lastSeenDaysAgo)} 전이야. 오늘은 잠깐이라도 올 거지?` : null),
      (c) => (c.lastSeenDaysAgo !== null && c.lastSeenDaysAgo >= 3 ? `${c.periodTopic} 좀 조용하네… 오랜만에 같이 있을래?` : null),
      (c) => `${c.periodWord}엔 아직 못 만났네. 오늘 잠깐 만날래?`,
    ],
    firstPeriod: [
      (c) =>
        c.sessions >= 2
          ? about('first', c.tense(`${c.periodWord}에 처음 만났지! 벌써 ${times(c.sessions)}이나 와 줘서 고마워.`, `${c.periodWord}에 처음 만났지! 그때 ${times(c.sessions)}이나 와 줬었어.`))
          : about('first', c.tense(`${c.periodWord}에 처음 만났지! 와 줘서 고마워. 자주 보자!`, `${c.periodWord}에 처음 만났었지! 그때 와 줘서 고마웠어.`)),
      (c) => about('first', `우리 ${c.periodWord}부터 시작${c.tense('이네', '이었지')}. ${c.total} 같이 있었어, 출발 좋다!`),
      (c) => (c.activeDays >= 2 ? about('active', `첫 ${c.period === 'week' ? '주' : '달'}부터 ${days(c.activeDays)}이나 ${c.tense('왔네', '왔었지')}! 이 기세 그대로 가 보자.`) : null),
    ],
    long: [
      (c) => about('longest', `${c.longest!.dayLabel}엔 ${c.longestDuration}이나 같이 있었어! 안 힘들었어?`),
      (c) => about('longest', `${c.periodWord} 제일 길었던 건 ${c.longest!.dayLabel}, ${c.longestDuration}! 진짜 대단했어.`),
      (c) => (c.longSessions >= 2 ? about('long', `2시간 넘게 같이 있었던 게 ${times(c.longSessions)}이야! 무리하진 마.`) : null),
    ],
    steady: [
      (c) => (c.isCurrent && c.streakDays >= 3 ? about('streak', `벌써 ${c.streakDays}일 연속이야! 매일 보니까 나도 좋다.`) : null),
      (c) => (c.activeDays === c.elapsedDays ? about('allDays', `${c.periodTopic} 하루도 안 빠졌어! ${days(c.activeDays)} 내내 와 줘서 고마워.`) : null),
      (c) => (c.activeDays >= 3 ? about('active', `${c.periodWord}만 ${days(c.activeDays)}이나 ${c.tense('왔네', '왔었지')}! 꾸준한 거 진짜 멋있다.`) : null),
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, 합쳐서 ${c.total}! 꾸준함은 네가 최고야.`),
    ],
    late: [
      (c) => about('late', `${c.periodWord}엔 주로 ${lateWord(c)}에 만났네. 늦게까지 고생 많았어.`),
      (c) =>
        c.lateMixed
          ? about('late', `늦은 시간에 온 게 ${times(c.lateSessions)}이야. 잠은 꼭 챙겨 자!`)
          : about('lateBand', `${timeBandLabels[c.lateBand!]}에 온 게 ${times(c.lateBandSessions)}이야. 잠은 꼭 챙겨 자!`),
      (c) => (c.isCurrent ? about('late', `늦은 시간에도 ${times(c.lateSessions)}이나 와 줘서 고마워. 오늘은 일찍 자자!`) : null),
    ],
    more: [
      (c) => about('active', `${c.periodWord}엔 ${times(c.sessions)}이나 ${c.tense('왔네', '왔었지')}! ${c.previousWord}보다 ${times(c.sessions - c.previousSessions)} 더 왔어.`),
      (c) => about('active', `${c.previousWord}엔 ${times(c.previousSessions)}이었는데 ${c.periodWord}엔 ${times(c.sessions)}! ${c.tense('점점 늘고 있어.', '그때 확 늘었지.')}`),
      (c) =>
        c.longest && c.longest.seconds >= 3600
          ? about('longest', `${c.periodWord}엔 ${times(c.sessions)}이나 ${c.tense('왔네', '왔었지')}! ${c.longest.dayLabel} ${timeBandLabels[c.longest.band]}엔 꽤 오래 있었지?`)
          : null,
    ],
    light: [
      (c) => (c.sessions === 1 ? about('longest', `${c.periodWord}엔 한 번 왔네. ${c.longest!.dayLabel}에 ${c.longestDuration} 같이 있었지!`) : null),
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, ${c.total} 같이 있었어. 다음엔 조금 더 자주 보자!`),
      (c) => (c.previousSessions > c.sessions ? about('active', `${c.previousWord}보단 적었지만 괜찮아. ${times(c.sessions)}이라도 와 줘서 고마워.`) : null),
    ],
    less: [
      (c) => about('active', `${c.periodTopic} ${c.previousWord}보다 조금 뜸했네. 바빴어? 와 줘서 고마워.`),
      (c) => `${c.periodWord} ${c.total} 같이 있었어. ${c.previousWord}보단 적어도 괜찮아, 천천히 가자.`,
    ],
    regular: [
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, 합쳐서 ${c.total} 같이 있었어. 수고 많았어!`),
      (c) => (c.longest ? about('longest', `${c.periodWord} ${days(c.activeDays)} 만났네. 제일 길었던 건 ${c.longest.dayLabel} ${c.longestDuration}!`) : null),
      (c) =>
        c.dominantBand && c.dominantBand.share >= 0.5
          ? about('band', `${c.periodWord}엔 주로 ${timeBandLabels[c.dominantBand.band]}에 만났지? ${times(c.sessions)} 와 줘서 고마워.`)
          : null,
    ],
  },
}

/**
 * 서도현 (2026-11-25 persona: a blunt childhood friend who is always there). Short 반말, teasing on the surface, caring
 * underneath. The same facts as 채린's voice; nothing the records do not contain.
 */
export const dohyunVoice: MateVoice = {
  id: 'dohyun',
  templates: {
    firstMeet: [
      () => '아직 같이 한 기록이 없네. 자리 맡아놨으니까 와.',
      () => '여긴 아직 비었어. …첫 캡슐은 같이 채우자.',
    ],
    missed: [
      (c) => (c.previousSessions > 0 ? `${c.periodWord}엔 한 번도 안 왔네. ${c.previousWord}엔 ${times(c.previousSessions)} 왔으면서.` : null),
      (c) => (c.lastSeenDaysAgo !== null && c.lastSeenDaysAgo >= 2 ? `너 ${days(c.lastSeenDaysAgo)}째 안 보이더라. …뭐, 바빴냐?` : null),
      (c) => `${c.periodWord}엔 아직이네. 자리 비워 둘게.`,
    ],
    firstPeriod: [
      (c) => about('first', c.tense(`${c.periodWord}부터 같이 했네. ${times(c.sessions)}이면 시작은 괜찮다.`, `${c.periodWord}부터 같이 했었지. 그때 ${times(c.sessions)} 왔었고.`)),
      (c) => about('first', `처음치고 ${c.total}이면 나쁘지 않네.`),
    ],
    long: [
      (c) => about('longest', `${c.longest!.dayLabel}엔 ${c.longestDuration}이나 붙어 있었네. 안 힘들었냐?`),
      (c) => (c.longSessions >= 2 ? about('long', `2시간 넘긴 게 ${times(c.longSessions)}이야. 쉬면서 해.`) : null),
    ],
    steady: [
      (c) => (c.isCurrent && c.streakDays >= 3 ? about('streak', `${c.streakDays}일 연속이네. …원래 이 정도는 했잖아.`) : null),
      (c) => (c.activeDays === c.elapsedDays ? about('allDays', `${c.periodTopic} 하루도 안 빠졌네. 꽤 하는데?`) : null),
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, 합쳐서 ${c.total}. 수고했어.`),
    ],
    late: [
      (c) => about('late', `${c.periodWord}엔 거의 ${lateWord(c)}에 왔네. 잠은 자면서 해.`),
      (c) => (c.isCurrent ? about('late', `늦게 온 게 ${times(c.lateSessions)}이야. 오늘은 일찍 자라.`) : null),
    ],
    more: [
      (c) => about('active', `${c.previousWord}보다 ${times(c.sessions - c.previousSessions)} 더 왔네. 좀 열심히 했다?`),
      (c) => about('active', `${c.previousWord} ${times(c.previousSessions)}, ${c.periodWord} ${times(c.sessions)}. ${c.tense('늘었네.', '그때 늘었지.')}`),
    ],
    light: [
      (c) => (c.sessions === 1 ? about('longest', `${c.periodWord}엔 한 번. ${c.longest!.dayLabel}에 ${c.longestDuration} 했지.`) : null),
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, ${c.total}. 다음엔 좀 더 와.`),
    ],
    less: [
      (c) => about('active', `${c.periodTopic} ${c.previousWord}보다 뜸했네. 바빴냐?`),
      (c) => `${c.periodWord} ${c.total}. 적어도 괜찮아, 천천히 해.`,
    ],
    regular: [
      (c) => about('active', `${c.periodWord} ${times(c.sessions)}, 합쳐서 ${c.total}. 고생했네.`),
      (c) => (c.longest ? about('longest', `${c.periodWord} 제일 길었던 건 ${c.longest.dayLabel} ${c.longestDuration}. 그날 좀 했지.`) : null),
    ],
  },
}

const voices = new Map<string, MateVoice>([[chaerinVoice.id, chaerinVoice], [dohyunVoice.id, dohyunVoice]])

/** Voice for a mate slug. Mates without their own lines speak with the shared friendly voice. */
export function voiceFor(mateId: string | undefined): MateVoice {
  return (mateId && voices.get(mateId)) || chaerinVoice
}

/** FNV-1a 32-bit. */
export function seedHash(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function commentContext(facts: PeriodFacts): CommentContext {
  return {
    ...facts,
    periodTopic: withParticle(facts.periodWord, '은', '는'),
    total: duration(facts.totalSeconds),
    longestDuration: facts.longest ? duration(facts.longest.seconds) : '',
    tense: (present, past) => (facts.isCurrent ? present : past),
  }
}

/** The days a line points at, from the same facts as the line. */
export function commentHighlight(focus: CommentFocus, facts: PeriodFacts): CommentHighlight {
  const { keys } = facts
  switch (focus) {
    case 'longest':
      return { days: facts.longest ? [facts.longest.dayKey] : [], streak: [] }
    case 'first':
      return { days: keys.first, streak: [] }
    case 'streak':
      return { days: keys.streak, streak: keys.streak.length >= 2 ? keys.streak : [] }
    case 'allDays':
      return { days: keys.active, streak: keys.active.length >= 2 ? keys.active : [] }
    case 'active':
      return { days: keys.active, streak: [] }
    case 'late':
      return { days: keys.late, streak: [] }
    case 'lateBand':
      return { days: keys.lateBand, streak: [] }
    case 'band':
      return { days: keys.dominantBand, streak: [] }
    case 'long':
      return { days: keys.long, streak: [] }
    case 'none':
      return { days: [], streak: [] }
  }
}

export function buildMateComment(input: MateCommentInput): MateComment | null {
  const facts = collectPeriodFacts(input)
  const kind = classifyPeriod(facts)
  if (!kind) return null
  const voice = input.voice ?? chaerinVoice
  const context = commentContext(facts)
  const candidates = voice.templates[kind]
    .map((template) => template(context))
    .filter((line): line is CommentLine => Boolean(line))
    .map((line) => (typeof line === 'string' ? { text: line, focus: 'none' as const } : line))
  if (candidates.length === 0) return null
  const seed = seedHash(`${input.seedKey}|${input.range.period}|${input.range.startDay}|${kind}`)
  const { text, focus } = candidates[seed % candidates.length]!
  return { kind, text, focus, highlight: commentHighlight(focus, facts) }
}
