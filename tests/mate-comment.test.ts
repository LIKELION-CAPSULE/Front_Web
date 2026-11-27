import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { getRecordRange, type RecordPeriod } from '../src/features/reports/record-period.ts'
import {
  buildMateComment,
  chaerinVoice,
  classifyPeriod,
  dohyunVoice,
  collectPeriodFacts,
  commentHighlight,
  mateCommentFromFacts,
  mateCommentKinds,
  timeBand,
  times,
  voiceFor,
  type MateCommentKind,
} from '../src/features/records/mate-comment.ts'
import { patternSessions, recordPatterns, type RecordPattern } from '../src/features/local-demo/record-patterns.ts'

const HOUR = 3_600_000
const MAX_LENGTH = 60
// Tuesday 2026-11-24 15:00 and Friday 2026-11-27 21:30 in Seoul.
const TUESDAY = Date.parse('2026-11-24T15:00:00+09:00')
const FRIDAY = Date.parse('2026-11-27T21:30:00+09:00')

function record(startedAt: number, minutes: number, patch: Partial<StudyRecord> = {}): StudyRecord {
  return {
    id: String(startedAt),
    roomId: '990201',
    characterIds: ['990301'],
    tier: 'basic',
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    studySeconds: minutes * 60,
    focusSeconds: minutes * 60,
    awaySeconds: 0,
    returns: 0,
    completed: false,
    automatic: false,
    ...patch,
  }
}
const at = (iso: string) => Date.parse(`${iso}+09:00`)
const patternRecords = (pattern: RecordPattern, now: number) =>
  patternSessions(pattern, now).map((s) => record(s.startedAt, s.seconds / 60, { id: String(s.id) }))

function comment(records: StudyRecord[], now: number, period: RecordPeriod = 'week', offset = 0, seedKey = 'user-1|990301') {
  return buildMateComment({ range: getRecordRange(period, now, offset), offset, now, records, seedKey })
}

test('each QA record pattern produces its intended comment type for the current week', () => {
  // 'stress' only measures the records board's frame rate (every day of the year); it has no intended comment.
  const expected: Record<Exclude<RecordPattern, 'stress'>, MateCommentKind> = {
    steady: 'steady',
    light: 'light',
    returning: 'missed',
    night: 'late',
    long: 'long',
    firstWeek: 'firstPeriod',
    none: 'firstMeet',
  }
  for (const now of [TUESDAY, FRIDAY]) {
    for (const pattern of recordPatterns) {
      if (pattern === 'stress') continue
      const result = comment(patternRecords(pattern, now), now)
      assert.equal(result?.kind, expected[pattern], `${pattern} @ ${new Date(now).toISOString()}`)
    }
  }
})

test('steady pattern reaches five or more days by Friday and never creates future records', () => {
  const records = patternRecords('steady', FRIDAY)
  assert.ok(records.every((r) => r.endedAt <= FRIDAY))
  const facts = collectPeriodFacts({ range: getRecordRange('week', FRIDAY), offset: 0, now: FRIDAY, records })
  assert.ok(facts.activeDays >= 5)
  assert.ok(facts.streakDays >= 5)
})

test('the same week, account and data always give the same sentence', () => {
  const records = patternRecords('steady', FRIDAY)
  const first = comment(records, FRIDAY)
  for (let i = 0; i < 5; i++) assert.deepEqual(comment(records, FRIDAY), first)
  // Some account seeds pick a different template for the same situation.
  const texts = new Set(Array.from({ length: 20 }, (_, i) => comment(records, FRIDAY, 'week', 0, `user-${i}|990301`)?.text))
  assert.ok(texts.size > 1)
})

test('sentences stay short and every template variant is reachable without exceeding the limit', () => {
  const nows = Array.from({ length: 14 }, (_, d) => TUESDAY + d * 24 * HOUR + (d % 3) * 5 * HOUR)
  const seen = new Set<string>()
  for (const now of nows) {
    for (const pattern of recordPatterns) {
      const records = patternRecords(pattern, now)
      for (const period of ['week', 'month', 'year'] as const) {
        for (const offset of [0, -1]) {
          for (let seed = 0; seed < 4; seed++) {
            const result = comment(records, now, period, offset, `seed-${seed}`)
            if (!result) continue
            seen.add(result.kind)
            assert.ok(result.text.length <= MAX_LENGTH, `${result.text.length}: ${result.text}`)
            assert.doesNotMatch(result.text, /undefined|null|NaN/)
          }
        }
      }
    }
  }
  for (const kind of ['firstMeet', 'missed', 'firstPeriod', 'long', 'steady', 'late', 'light'] as const) assert.ok(seen.has(kind), kind)
})

test('long comment names the real longest day and duration', () => {
  const now = FRIDAY
  const records = [record(at('2026-11-25T14:00:00'), 190), record(at('2026-11-23T09:30:00'), 150), record(at('2026-11-17T19:00:00'), 50)]
  const result = comment(records, now)
  assert.equal(result?.kind, 'long')
  const longTemplates = chaerinVoice.templates.long
  assert.ok(longTemplates.length >= 2)
  // Whatever template is picked, the facts it uses are the Wednesday 3h10 session.
  const facts = collectPeriodFacts({ range: getRecordRange('week', now), offset: 0, now, records })
  assert.deepEqual(facts.longest, { seconds: 190 * 60, dayLabel: '수요일', band: 'day', dayKey: '2026-11-25' })
  assert.equal(facts.longSessions, 2)
  if (/요일/.test(result!.text)) assert.match(result!.text, /수요일/)
  if (/시간/.test(result!.text)) assert.match(result!.text, /3시간 10분|2시간/)
})

test('more and less compare with the previous week by count only', () => {
  const lastWeek = [record(at('2026-11-17T19:00:00'), 40)]
  const thisWeek = [record(at('2026-11-23T19:00:00'), 40), record(at('2026-11-25T13:00:00'), 30), record(at('2026-11-26T12:00:00'), 20)]
  const more = collectPeriodFacts({ range: getRecordRange('week', FRIDAY), offset: 0, now: FRIDAY, records: [...lastWeek, ...thisWeek] })
  assert.equal(more.sessions, 3)
  assert.equal(more.previousSessions, 1)
  assert.equal(classifyPeriod(more), 'more')

  const busyLastWeek = [16, 17, 18, 19].map((d) => record(at(`2026-11-${d}T19:00:00`), 40))
  const fewer = [record(at('2026-11-23T19:00:00'), 40), record(at('2026-11-25T19:00:00'), 40), record(at('2026-11-26T12:00:00'), 40)]
  assert.equal(classifyPeriod(collectPeriodFacts({ range: getRecordRange('week', FRIDAY), offset: 0, now: FRIDAY, records: [...busyLastWeek, ...fewer] })), 'less')
})

test('night and dawn are judged by start time in Seoul', () => {
  assert.equal(timeBand(at('2026-11-23T00:40:00')), 'dawn')
  assert.equal(timeBand(at('2026-11-23T07:00:00')), 'morning')
  assert.equal(timeBand(at('2026-11-23T13:00:00')), 'day')
  assert.equal(timeBand(at('2026-11-23T19:00:00')), 'evening')
  assert.equal(timeBand(at('2026-11-23T22:00:00')), 'night')
})

test('past periods use past wording, and an empty past period has no comment', () => {
  const records = patternRecords('returning', TUESDAY)
  const lastWeek = comment(records, TUESDAY, 'week', -1)
  assert.ok(lastWeek)
  assert.match(lastWeek!.text, /지난주|그 전 주|요일|번|분/)
  assert.equal(comment(records, TUESDAY, 'week', -4), null)
  assert.equal(comment([], TUESDAY, 'week', -1), null)
})

test('the missed comment only states counts that exist', () => {
  const records = patternRecords('returning', TUESDAY)
  const facts = collectPeriodFacts({ range: getRecordRange('week', TUESDAY), offset: 0, now: TUESDAY, records })
  assert.equal(facts.sessions, 0)
  assert.equal(facts.previousSessions, 3)
  assert.equal(facts.lastSeenDaysAgo, 3)
  for (let seed = 0; seed < 10; seed++) {
    const text = comment(records, TUESDAY, 'week', 0, `s${seed}`)!.text
    if (/[한두세네] 번|\d번/.test(text)) assert.match(text, /세 번/)
    if (/일 전/.test(text)) assert.match(text, /3일 전/)
  }
})

test('month and year periods reuse the same rules with their own words', () => {
  const records = patternRecords('steady', FRIDAY)
  const month = comment(records, FRIDAY, 'month')
  const year = comment(records, FRIDAY, 'year')
  assert.ok(month && year)
  assert.doesNotMatch(month!.text, /이번 주|요일/)
  assert.doesNotMatch(year!.text, /이번 주|이번 달|요일/)
})

test('voices are registered per mate and unknown mates fall back to the shared voice', () => {
  assert.equal(voiceFor('chaerin'), chaerinVoice)
  assert.equal(voiceFor('someone-new'), chaerinVoice)
  assert.equal(voiceFor(undefined), chaerinVoice)
  for (const kind of mateCommentKinds) assert.ok(chaerinVoice.templates[kind].length >= 2, kind)
  // 서도현 speaks in his own voice for every kind, never 채린's lines.
  assert.equal(voiceFor('dohyun'), dohyunVoice)
  for (const kind of mateCommentKinds) assert.ok(dohyunVoice.templates[kind].length >= 2, kind)
})

test('서도현: his lines come from the same facts, stay short and never repeat 채린', () => {
  const chaerinLines = new Set<string>()
  const dohyunLines = new Set<string>()
  for (const pattern of recordPatterns) {
    if (pattern === 'stress') continue
    const records = patternSessions(pattern, FRIDAY).map((session) => record(session.startedAt, session.seconds / 60, { id: String(session.id) }))
    for (const seedKey of ['a', 'b', 'c', 'd']) {
      const range = getRecordRange('week', FRIDAY, 0)
      const chaerin = buildMateComment({ range, offset: 0, now: FRIDAY, records, seedKey, voice: chaerinVoice })
      const dohyun = buildMateComment({ range, offset: 0, now: FRIDAY, records, seedKey, voice: dohyunVoice })
      assert.ok(dohyun && chaerin)
      assert.equal(dohyun!.kind, chaerin!.kind, pattern)
      assert.ok(dohyun!.text.length <= MAX_LENGTH, dohyun!.text)
      chaerinLines.add(chaerin!.text)
      dohyunLines.add(dohyun!.text)
    }
  }
  for (const line of dohyunLines) assert.ok(!chaerinLines.has(line), line)
})

test('Korean counters read naturally', () => {
  assert.equal(times(1), '한 번')
  assert.equal(times(4), '네 번')
  assert.equal(times(7), '7번')
})

test('a line points at the days it speaks about, from the same facts (records board emphasis)', () => {
  // Monday to Tuesday every day (streak of 2 days in the week, more before), the longest on Monday.
  const records = [
    record(at('2026-11-20T20:00:00'), 40),
    record(at('2026-11-21T20:00:00'), 40),
    record(at('2026-11-22T20:00:00'), 40),
    record(at('2026-11-23T20:00:00'), 150),
    record(at('2026-11-24T09:00:00'), 40),
  ]
  const facts = collectPeriodFacts({ range: getRecordRange('week', TUESDAY), offset: 0, now: TUESDAY, records })
  assert.equal(facts.longest?.dayKey, '2026-11-23')
  assert.deepEqual(facts.keys.active, ['2026-11-23', '2026-11-24'])
  // The streak runs from 11-20, but only its days inside the week can be lit.
  assert.equal(facts.streakDays, 5)
  assert.deepEqual(facts.keys.streak, ['2026-11-23', '2026-11-24'])
  assert.deepEqual(facts.keys.long, ['2026-11-23'])
  assert.deepEqual(commentHighlight('longest', facts), { days: ['2026-11-23'], streak: [] })
  assert.deepEqual(commentHighlight('streak', facts), { days: ['2026-11-23', '2026-11-24'], streak: ['2026-11-23', '2026-11-24'] })
  assert.deepEqual(commentHighlight('none', facts), { days: [], streak: [] })
  // Over many seeds every chosen line's highlight agrees with its focus and its text.
  for (let seed = 0; seed < 40; seed++) {
    const line = comment(records, TUESDAY, 'week', 0, `user-${seed}`)!
    assert.deepEqual(line.highlight, commentHighlight(line.focus, facts))
    if (line.focus === 'longest') assert.ok(line.text.includes('월요일'), line.text)
    if (line.focus === 'streak') assert.ok(line.text.includes('연속'), line.text)
  }
})

test('late lines light the late days (night or dawn), a single band its own days', () => {
  const records = [record(at('2026-11-23T23:00:00'), 50), record(at('2026-11-24T01:00:00'), 50), record(at('2026-11-24T10:00:00'), 20)]
  const facts = collectPeriodFacts({ range: getRecordRange('week', TUESDAY), offset: 0, now: TUESDAY, records })
  // 01:00 is still the evening of the 23rd (a day runs from 05:00, the server's rule).
  assert.deepEqual(commentHighlight('late', facts).days, ['2026-11-23'])
  assert.deepEqual(commentHighlight('lateBand', facts).days, ['2026-11-23'])
})

test('all-mates scope names the speaker ("나랑") so own counts never contradict the combined totals', () => {
  const range = getRecordRange('week', FRIDAY)
  const facts = collectPeriodFacts({ range, offset: 0, now: FRIDAY, records: patternRecords('steady', FRIDAY) })
  for (const voice of [chaerinVoice, dohyunVoice]) {
    for (let seed = 0; seed < 12; seed++) {
      const line = mateCommentFromFacts(facts, { range, seedKey: `u-${seed}`, voice, scope: 'all' })
      assert.ok(line)
      assert.match(line.text, /나랑/)
      assert.ok(line.text.length <= MAX_LENGTH, `${line.text.length}: ${line.text}`)
    }
  }
})

