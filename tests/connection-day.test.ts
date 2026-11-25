import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import {
  completedRecords,
  connectionDayKey,
  connectionStartedAt,
  isCompletedRecord,
} from '../src/features/records/connection-day.ts'
import { getRecordRange, recordsInRange } from '../src/features/reports/record-period.ts'
import { buildCapsuleCalendar, selectCapsuleDay } from '../src/features/records/capsule-calendar.ts'
import { buildMateComment, collectPeriodFacts } from '../src/features/records/mate-comment.ts'
import { capsuleRecordsFromStudyRecords, groupCapsulesByDay } from '../src/features/mates/capsule-jar/capsule-jar-data.ts'
import { carryByIds, isStillPresent, planPour, POUR } from '../src/features/mates/capsule-jar/capsule-pour.ts'

const at = (iso: string) => Date.parse(`${iso}+09:00`)

function connection(startIso: string, endIso: string, patch: Partial<StudyRecord> = {}): StudyRecord {
  const startedAt = at(startIso)
  const endedAt = at(endIso)
  return {
    id: startIso,
    roomId: '990201',
    characterIds: ['990301'],
    tier: 'basic',
    startedAt,
    endedAt,
    studySeconds: Math.round((endedAt - startedAt) / 1000),
    focusSeconds: Math.round((endedAt - startedAt) / 1000),
    awaySeconds: 0,
    returns: 0,
    completed: true,
    automatic: false,
    serverReport: { studySeconds: Math.round((endedAt - startedAt) / 1000) } as StudyRecord['serverReport'],
    ...patch,
  }
}

// ── Date rule: the start time, in Seoul ──

test('a connection across Seoul midnight belongs to the day it started', () => {
  const late = connection('2026-11-23T23:30:00', '2026-11-24T00:40:00')
  assert.equal(connectionStartedAt(late), at('2026-11-23T23:30:00'))
  assert.equal(connectionDayKey(late), '2026-11-23')
  // The day runs from 05:00 Seoul time (the server's rule for 38): 00:00 and 04:59 are still the evening before …
  assert.equal(connectionDayKey(connection('2026-11-24T00:00:00', '2026-11-24T00:30:00')), '2026-11-23')
  assert.equal(connectionDayKey(connection('2026-11-24T04:59:00', '2026-11-24T05:30:00')), '2026-11-23')
  // … 05:00 begins the next day.
  assert.equal(connectionDayKey(connection('2026-11-24T05:00:00', '2026-11-24T05:30:00')), '2026-11-24')
  // Without a start the end is used.
  assert.equal(connectionDayKey({ startedAt: 0, endedAt: at('2026-11-24T00:10:00') }), '2026-11-23')
})

test('month end and year end: the connection stays in the month / year it started', () => {
  const now = at('2027-01-05T12:00:00')
  const monthEnd = connection('2026-11-30T23:50:00', '2026-12-01T01:00:00')
  const yearEnd = connection('2026-12-31T23:40:00', '2027-01-01T00:30:00')
  const records = [monthEnd, yearEnd]
  const november = getRecordRange('month', at('2026-11-20T12:00:00'))
  const december = getRecordRange('month', at('2026-12-20T12:00:00'))
  const year2026 = getRecordRange('year', at('2026-06-01T12:00:00'))
  const year2027 = getRecordRange('year', now)
  assert.deepEqual(recordsInRange(records, november).map((r) => r.id), [monthEnd.id])
  assert.deepEqual(recordsInRange(records, december).map((r) => r.id), [yearEnd.id])
  assert.deepEqual(recordsInRange(records, year2026).map((r) => r.id), [yearEnd.id, monthEnd.id])
  assert.deepEqual(recordsInRange(records, year2027), [])
})

test('calendar, selected day, comment and capsules agree on the day of a midnight connection', () => {
  const now = at('2026-11-24T15:00:00') // Tuesday
  const late = connection('2026-11-23T23:30:00', '2026-11-24T00:40:00') // Monday night
  const range = getRecordRange('week', now)
  const calendar = buildCapsuleCalendar([late], range)
  const monday = calendar.days.find((day) => day.key === '2026-11-23')!
  const tuesday = calendar.days.find((day) => day.key === '2026-11-24')!
  assert.equal(monday.sessions, 1)
  assert.equal(tuesday.sessions, 0)
  assert.deepEqual(selectCapsuleDay([late], monday).records.map((r) => r.id), [late.id])

  const facts = collectPeriodFacts({ range, offset: 0, now, records: [late] })
  assert.equal(facts.activeDays, 1)
  assert.equal(facts.longest?.dayLabel, '월요일')
  assert.equal(facts.longest?.band, 'night')

  const capsules = capsuleRecordsFromStudyRecords([late], '990301', now)
  assert.equal(groupCapsulesByDay(capsules)[0]!.day, '2026.11.23 (월)')
})

// ── Cutoff: only connections that have ended ──

test('connections ending after now are left out everywhere', () => {
  const now = at('2026-11-24T15:00:00')
  const done = connection('2026-11-24T10:00:00', '2026-11-24T11:00:00')
  const endsNow = connection('2026-11-24T14:00:00', '2026-11-24T15:00:00')
  const future = connection('2026-11-24T14:30:00', '2026-11-24T16:00:00')
  assert.equal(isCompletedRecord(endsNow, now), true)
  assert.equal(isCompletedRecord(future, now), false)
  assert.deepEqual(completedRecords([done, endsNow, future], now).map((r) => r.id), [done.id, endsNow.id])

  const range = getRecordRange('week', now)
  assert.equal(collectPeriodFacts({ range, offset: 0, now, records: [done, future] }).sessions, 1)
  assert.deepEqual(capsuleRecordsFromStudyRecords([done, future], '990301', now).map((c) => c.id), [done.id])
})

// ── Comment wording for late connections ──

test('night and dawn together are 늦은 시간; a single band names its own count', () => {
  const now = at('2026-11-27T12:00:00') // Friday
  const range = getRecordRange('week', now)
  const mixed = [
    connection('2026-11-23T22:00:00', '2026-11-23T22:40:00'),
    connection('2026-11-24T01:00:00', '2026-11-24T01:40:00'),
    connection('2026-11-25T02:00:00', '2026-11-25T02:40:00'),
  ]
  const mixedFacts = collectPeriodFacts({ range, offset: 0, now, records: mixed })
  assert.equal(mixedFacts.lateSessions, 3)
  assert.equal(mixedFacts.lateMixed, true)
  assert.equal(mixedFacts.lateBand, 'dawn')
  assert.equal(mixedFacts.lateBandSessions, 2)

  const nightOnly = [
    connection('2026-11-23T22:00:00', '2026-11-23T22:40:00'),
    connection('2026-11-24T21:30:00', '2026-11-24T22:10:00'),
  ]
  const nightFacts = collectPeriodFacts({ range, offset: 0, now, records: nightOnly })
  assert.equal(nightFacts.lateMixed, false)
  assert.equal(nightFacts.lateBand, 'night')
  assert.equal(nightFacts.lateBandSessions, 2)

  // Whatever template the seed picks, a mixed week never calls everything "밤" or "새벽".
  for (let seed = 0; seed < 40; seed++) {
    const text = buildMateComment({ range, offset: 0, now, records: mixed, seedKey: `user-${seed}` })!.text
    assert.doesNotMatch(text, /주로 (밤|새벽)에|(밤|새벽)에 온 게/)
  }
  const texts = new Set<string>()
  for (let seed = 0; seed < 40; seed++) {
    texts.add(buildMateComment({ range, offset: 0, now, records: nightOnly, seedKey: `user-${seed}` })!.text)
  }
  for (const text of texts) {
    if (text.includes('에 온 게')) assert.match(text, /밤에 온 게 두 번이야/)
  }
})

// ── Entry pour ──

test('the pour ends within its duration, new capsules fall last, at most 60 fall', () => {
  const ids = Array.from({ length: 200 }, (_, index) => `c${index}`)
  const fresh = ['c197', 'c198', 'c199']
  for (const durationMs of [POUR.enterMs, POUR.switchMs]) {
    const plan = planPour(ids, fresh, { durationMs })
    assert.ok(plan.total <= durationMs / 1000 + 1e-9, `${plan.total} > ${durationMs}`)
    assert.ok(plan.total >= 0.7 * (durationMs / 1000))
    assert.equal(plan.steps.length, POUR.maxFalling)
    // The falling ones are the top of the pile (the last in order).
    assert.equal(Math.min(...plan.steps.map((step) => step.index)), 200 - POUR.maxFalling)
    const newSteps = plan.steps.filter((step) => step.isNew)
    const regular = plan.steps.filter((step) => !step.isNew)
    assert.deepEqual(newSteps.map((step) => step.index), [197, 198, 199])
    assert.ok(Math.min(...newSteps.map((step) => step.start)) > Math.max(...regular.map((step) => step.start)))
  }
  // A few capsules: all fall, still within the time.
  const small = planPour(['a', 'b', 'c'], [], { durationMs: POUR.enterMs })
  assert.equal(small.steps.length, 3)
  assert.ok(small.total <= 1.5)
  assert.deepEqual(planPour([], [], { durationMs: POUR.enterMs }), { steps: [], total: 0 })
  // Arriving while the page is open: only the new ones fall.
  const onlyNew = planPour(ids, ['c199'], { durationMs: POUR.switchMs, maxFalling: 0 })
  assert.deepEqual(onlyNew.steps.map((step) => step.index), [199])
})

// ── Opened / falling capsules across a layout change ──

test('animation state follows capsules by id when the layout changes', () => {
  const before = ['a', 'b', 'c', 'd']
  const after = ['x', 'a', 'c', 'd'] // 'b' gone, a capsule inserted before 'a'
  const falling = new Map([[1, 'b-drop'], [2, 'c-drop'], [3, 'd-drop']])
  assert.deepEqual([...carryByIds(falling, before, after)], [[2, 'c-drop'], [3, 'd-drop']])
  assert.equal(isStillPresent('c', after), true)
  assert.equal(isStillPresent('b', after), false)
  assert.equal(isStillPresent(null, after), false)
})
