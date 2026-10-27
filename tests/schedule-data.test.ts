import assert from 'node:assert/strict'
import test from 'node:test'
import { scheduleCountdown, scheduleMonthDays, selectSchedule, shiftScheduleMonth } from '../src/features/schedule/schedule-data.ts'
import type { Memory } from '../src/features/demo/types.ts'
import { createDemoState } from '../src/features/demo/seed.ts'
import { migrateSharedSchedule } from '../src/features/schedule/migrate-schedule.ts'
import { DEMO_STORAGE_KEY, loadDemoState } from '../src/features/demo/persistence.ts'
import { createPastScheduleSamples, migrateScheduleSamples, SCHEDULE_SAMPLE_VERSION } from '../src/features/demo/sample-schedule.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { dayKey } from '../src/shared/lib/format.ts'

const memory = (id: string, date: string, time = ''): Memory => ({
  id,
  date,
  time,
  title: id,
  kind: time ? '약속' : '시험',
})
const memories = [
  memory('old', '2026-10-20'),
  memory('tomorrow', '2026-10-28', '19:00'),
  memory('late', '2026-10-27', '20:00'),
  memory('yesterday', '2026-10-26'),
  memory('all-day', '2026-10-27'),
  memory('early', '2026-10-27', '10:00'),
]

test('schedule countdowns use calendar days across leap months and year boundaries', () => {
  assert.equal(scheduleCountdown('2026-10-29', '2026-10-28'), 'D-1')
  assert.equal(scheduleCountdown('2026-10-28', '2026-10-28'), 'D-DAY')
  assert.equal(scheduleCountdown('2026-10-27', '2026-10-28'), null)
  assert.equal(scheduleCountdown('2027-01-01', '2026-12-31'), 'D-1')
  assert.equal(scheduleCountdown('2028-03-01', '2028-02-28'), 'D-2')
  assert.equal(scheduleCountdown('invalid', '2026-10-28'), null)
})

test('new demo schedules include past events relative to the current Seoul date', () => {
  const now = Date.parse('2026-10-28T00:30:00+09:00')
  const source = createDemoState(now)
  const past = selectSchedule(source.memories, 'past', dayKey(now))
  assert.deepEqual(past, createPastScheduleSamples(now))
  assert.equal(past.length, 3)
  assert.equal(selectSchedule(source.memories, 'upcoming', dayKey(now)).length, 3)
  assert.ok(past.every((memory) => !('characterId' in memory)))
})

test('past schedule fixtures are added once without resetting user data or resurrecting deletions', () => {
  const now = Date.parse('2026-10-28T20:00:00+09:00')
  const custom = memory('my-event', '2026-11-10')
  const existingSample = { ...createPastScheduleSamples(now)[0]!, title: '수정한 샘플 일정' }
  const source = {
    ...createDemoState(now),
    scheduleSampleVersion: undefined,
    memories: [custom, existingSample],
  }
  const migrated = migrateScheduleSamples(source, now)
  assert.equal(migrated.scheduleSampleVersion, SCHEDULE_SAMPLE_VERSION)
  assert.equal(migrated.memories.length, 4)
  assert.equal(migrated.memories[0], custom)
  assert.equal(migrated.memories[1], existingSample)
  assert.equal(migrated.profile, source.profile)
  assert.equal(migrated.ledger, source.ledger)
  assert.equal(migrated.records, source.records)
  assert.equal(source.memories.length, 2)
  const deleted = demoReducer(migrated, { type: 'DELETE_MEMORY', id: existingSample.id })
  assert.equal(migrateScheduleSamples(deleted, now + 86400000), deleted)
  assert.ok(!deleted.memories.some((item) => item.id === existingSample.id))
})

test('schedule calendars retain leap days and Monday-first positions with complete week rows', () => {
  const leap = scheduleMonthDays('2028-02')
  assert.equal(leap.filter(Boolean).length, 29)
  assert.equal(leap[0], null)
  assert.equal(leap[1], '2028-02-01')
  assert.equal(leap[29], '2028-02-29')
  assert.equal(leap.length % 7, 0)
  const sixRows = scheduleMonthDays('2026-11')
  assert.equal(sixRows.length, 42)
  assert.equal(sixRows[6], '2026-11-01')
  assert.equal(sixRows[35], '2026-11-30')
  assert.equal(scheduleMonthDays('2026-02').filter(Boolean).length, 28)
})

test('schedule month navigation crosses year boundaries without skipping short months', () => {
  assert.equal(shiftScheduleMonth('2026-12', 1), '2027-01')
  assert.equal(shiftScheduleMonth('2026-01', -1), '2025-12')
  assert.equal(shiftScheduleMonth('2028-03', -1), '2028-02')
  assert.equal(shiftScheduleMonth('2026-10', 12), '2027-10')
})

test('dropdown calendars show neighboring dates across year boundaries with Sunday-first weeks', () => {
  const january = scheduleMonthDays('2026-01', { weekStartsOn: 0, showOutsideDays: true })
  assert.equal(january[0], '2025-12-28')
  assert.equal(january[4], '2026-01-01')
  assert.equal(january.at(-1), '2026-01-31')
  assert.equal(january.length % 7, 0)
  const leap = scheduleMonthDays('2028-02', { weekStartsOn: 0, showOutsideDays: true })
  assert.equal(leap[0], '2028-01-30')
  assert.ok(leap.includes('2028-02-29'))
  assert.equal(leap.at(-1), '2028-03-04')
})

test('shared schedule orders upcoming dates and times before newest past events without mutating storage', () => {
  const sourceOrder = memories.map((item) => item.id)
  assert.deepEqual(
    selectSchedule(memories, 'all', '2026-10-27').map((item) => item.id),
    ['all-day', 'early', 'late', 'tomorrow', 'yesterday', 'old'],
  )
  assert.deepEqual(
    memories.map((item) => item.id),
    sourceOrder,
  )
})

test('shared period filters include same-day and all-day events', () => {
  assert.deepEqual(
    selectSchedule(memories, 'upcoming', '2026-10-27').map((item) => item.id),
    ['all-day', 'early', 'late', 'tomorrow'],
  )
  assert.deepEqual(
    selectSchedule(memories, 'past', '2026-10-27').map((item) => item.id),
    ['yesterday', 'old'],
  )
  assert.deepEqual(selectSchedule([], 'all', '2026-10-27'), [])
})

test('legacy character memories become shared schedules without losing events or other user data', () => {
  const source = createDemoState()
  const shared = memory('already-shared', '2026-11-01')
  const legacy = memories.map((item, index) => ({
    ...item,
    characterId: index % 2 ? 'doyun' : 'chaerin',
  }))
  source.memories = [...legacy, shared]
  const migrated = migrateSharedSchedule(source)
  assert.deepEqual(migrated.memories, [...memories, shared])
  assert.equal(migrated.memories.at(-1), shared)
  assert.ok(legacy.every((item) => 'characterId' in item))
  assert.equal(migrated.records, source.records)
  assert.equal(migrated.profile, source.profile)
  assert.equal(migrated.ledger, source.ledger)
  assert.equal(migrated.messages, source.messages)
  assert.equal(migrateSharedSchedule(migrated), migrated)
})

test('loading both legacy and shared schedules preserves saved profile, credit and real study history', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    for (const legacy of [true, false]) {
      const source = createDemoState()
      source.profile.name = '일정 보존 확인'
      source.scheduleSampleVersion = legacy ? undefined : SCHEDULE_SAMPLE_VERSION
      source.records = [{ ...source.records[0]!, id: 'real-study-record' }]
      source.latestRecordId = 'real-study-record'
      source.memories = memories.map((item) => legacy ? { ...item, characterId: 'sua' } : item)
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => key === DEMO_STORAGE_KEY ? JSON.stringify(source) : null,
        },
      })
      const loaded = loadDemoState()
      assert.deepEqual(
        loaded.memories.filter((item) => !item.id.startsWith('sample-schedule-v1-')),
        memories,
      )
      assert.equal(loaded.memories.length, memories.length + (legacy ? 3 : 0))
      assert.equal(loaded.scheduleSampleVersion, SCHEDULE_SAMPLE_VERSION)
      assert.deepEqual(loaded.profile, source.profile)
      assert.equal(loaded.credits, source.credits)
      assert.deepEqual(loaded.ledger, source.ledger)
      assert.ok(loaded.records.some((item) => item.id === 'real-study-record'))
      assert.equal(loaded.latestRecordId, source.latestRecordId)
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
