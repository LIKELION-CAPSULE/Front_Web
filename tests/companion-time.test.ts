import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { createSampleRecords, migrateSampleRecords } from '../src/features/demo/sample-records.ts'
import { studyRooms } from '../src/features/rooms/data/rooms.ts'
import { companionTimeSeries } from '../src/features/reports/companion-time.ts'
import {
  getRecordRange,
  recordSummary,
  recordsInRange,
} from '../src/features/reports/record-period.ts'
import { dayKey } from '../src/shared/lib/format.ts'

const now = Date.parse('2026-10-27T20:00:00+09:00')
const characters = studyRooms.flatMap((room) => room.characters)

test('sample history spans elapsed months with distinct character and period measurements', () => {
  const records = createSampleRecords(now)
  assert.deepEqual(createSampleRecords(now), records)
  assert.equal(new Set(records.map((record) => dayKey(record.endedAt).slice(0, 7))).size, 10)
  assert.equal(new Set(records.map((record) => record.id)).size, records.length)
  assert.ok(
    records.every(
      (record) =>
        record.endedAt <= now && record.focusSeconds + record.awaySeconds === record.studySeconds,
    ),
  )
  const focusByPeriod: number[] = []
  const focusByCharacter = new Map<string, number[]>()
  for (const period of ['week', 'month', 'year'] as const) {
    const range = getRecordRange(period, now)
    const included = recordsInRange(records, range)
    const { series } = companionTimeSeries(included, characters, range)
    const count = period === 'week' ? 8 : period === 'month' ? 14 : 19
    assert.equal(series.length, count)
    assert.equal(new Set(series.map((item) => item.seconds)).size, count)
    assert.equal(new Set(series.map((item) => item.focusRate)).size, count)
    focusByPeriod.push(recordSummary(included).focusRate)
    for (const item of series) {
      const rates = focusByCharacter.get(item.id) ?? []
      rates.push(item.focusRate)
      focusByCharacter.set(item.id, rates)
    }
    assert.equal(
      series.reduce((total, item) => total + item.seconds, 0),
      recordSummary(included).seconds,
    )
  }
  assert.equal(new Set(focusByPeriod).size, 3)
  for (const rates of focusByCharacter.values()) assert.equal(new Set(rates).size, rates.length)
})

test('old fixture migration retains real records and all other saved state', () => {
  const source = createDemoState(now)
  const real = { ...source.records[0]!, id: 'session-real' }
  const legacy = { ...source.records[1]!, id: 'sample-0-0' }
  const previousFixture = { ...legacy, id: 'sample-v2-year-1-2-0' }
  const saved = {
    ...source,
    records: [real, legacy, previousFixture],
    latestRecordId: real.id,
    savedRooms: ['room-2'],
  }
  const migrated = migrateSampleRecords(saved, now)
  assert.equal(
    migrated.records.find((record) => record.id === real.id),
    real,
  )
  assert.ok(!migrated.records.some((record) => record.id === legacy.id))
  assert.ok(!migrated.records.some((record) => record.id === previousFixture.id))
  assert.equal(migrated.latestRecordId, real.id)
  assert.equal(migrated.profile, saved.profile)
  assert.equal(migrated.ledger, saved.ledger)
  assert.equal(migrated.savedRooms, saved.savedRooms)
  assert.equal(migrateSampleRecords(migrated, now), migrated)
})

test('line buckets conserve shared time and leave future months unmeasured', () => {
  const record = {
    ...createSampleRecords(now)[0]!,
    endedAt: now,
    characterIds: ['chaerin', 'sua'],
    studySeconds: 1200,
    focusSeconds: 1050,
    awaySeconds: 150,
  }
  const { buckets, series } = companionTimeSeries([record], characters, getRecordRange('year', now))
  assert.equal(buckets.length, 12)
  assert.equal(series.length, 2)
  for (const item of series) {
    assert.equal(item.seconds, 600)
    assert.equal(item.focusRate, 87.5)
    assert.equal(item.points[9]!.seconds, 600)
    assert.equal(item.points[9]!.cumulativeSeconds, 600)
    assert.equal(item.points[0]!.seconds, 0)
    assert.equal(item.points[0]!.cumulativeSeconds, 0)
    assert.equal(item.points[10]!.seconds, null)
    assert.equal(item.points[10]!.cumulativeSeconds, null)
    assert.equal(item.points[11]!.seconds, null)
  }
})

test('cumulative lines start at the chosen period, carry rest days and end at the shared total', () => {
  const base = createSampleRecords(now)[0]!
  const first = {
    ...base,
    id: 'first',
    endedAt: Date.parse('2026-10-06T18:00:00+09:00'),
    characterIds: ['chaerin', 'sua'],
    studySeconds: 1200,
    focusSeconds: 1000,
    awaySeconds: 200,
  }
  const second = {
    ...first,
    id: 'second',
    endedAt: Date.parse('2026-10-10T18:00:00+09:00'),
    characterIds: ['chaerin'],
    studySeconds: 900,
    focusSeconds: 810,
    awaySeconds: 90,
  }
  const before = { ...second, id: 'before', endedAt: Date.parse('2026-09-30T18:00:00+09:00') }
  const { series } = companionTimeSeries(
    [before, first, second],
    characters,
    getRecordRange('month', now),
  )
  const chaerin = series.find((item) => item.id === 'chaerin')!
  assert.equal(chaerin.points[0]!.cumulativeSeconds, 0)
  assert.equal(chaerin.points[5]!.seconds, 600)
  assert.equal(chaerin.points[5]!.cumulativeSeconds, 600)
  assert.equal(chaerin.points[6]!.seconds, 0)
  assert.equal(chaerin.points[6]!.cumulativeSeconds, 600)
  assert.equal(chaerin.points[9]!.seconds, 900)
  assert.equal(chaerin.points[9]!.cumulativeSeconds, 1500)
  assert.equal(chaerin.points[26]!.cumulativeSeconds, chaerin.seconds)
  assert.equal(chaerin.points[27]!.cumulativeSeconds, null)
  for (const item of series) {
    const measured = item.points.flatMap((point) =>
      point.cumulativeSeconds === null ? [] : [point.cumulativeSeconds],
    )
    assert.ok(measured.every((value, index) => index === 0 || value >= measured[index - 1]!))
  }
})
