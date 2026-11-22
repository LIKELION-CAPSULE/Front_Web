import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBarChartData,
  buildCalendarData,
  calendarIntensityLevel,
  computeChartScale,
  resolveSummaryDisplay,
} from '../src/features/reports/records-view-utils.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

function makeRecord(overrides: Partial<StudyRecord> & { id: string }): StudyRecord {
  const endedAt = overrides.endedAt ?? Date.parse('2026-11-23T14:00:00+09:00')
  const startedAt = overrides.startedAt ?? endedAt - 1500_000
  return {
    roomId: '101',
    characterIds: ['201'],
    tier: 'basic',
    startedAt,
    endedAt,
    studySeconds: 1500,
    focusSeconds: 0,
    awaySeconds: 0,
    returns: 0,
    completed: true,
    automatic: false,
    serverReport: {
      sessionId: Number(overrides.id) || 9001,
      roomName: '새벽 도서관',
      character: { id: 201, name: '채린' },
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      studySeconds: 1500,
      presentSeconds: 1380,
      awaySeconds: 120,
      returnCount: 2,
    },
    ...overrides,
  }
}

test('calendarIntensityLevel assigns level 0 for empty, at least level 1 for any positive record, and handles maxSeconds=0', () => {
  assert.equal(calendarIntensityLevel(0, 3600), 0)
  assert.equal(calendarIntensityLevel(-10, 3600), 0)
  assert.equal(calendarIntensityLevel(0, 0), 0)
  // Even a small value (23 min vs 10 hours) gets level 1, never 0
  assert.equal(calendarIntensityLevel(1380, 36000), 1)
  // Positive seconds when maxSeconds is 0 still gets level 1
  assert.equal(calendarIntensityLevel(600, 0), 1)
  // 4-step quartiles
  assert.equal(calendarIntensityLevel(900, 3600), 1)
  assert.equal(calendarIntensityLevel(1800, 3600), 2)
  assert.equal(calendarIntensityLevel(2700, 3600), 3)
  assert.equal(calendarIntensityLevel(3600, 3600), 4)
})

test('computeChartScale generates clean Korean-unit ticks without English "m"', () => {
  const zeroScale = computeChartScale(0)
  assert.ok(zeroScale.maxSeconds > 0)
  assert.ok(zeroScale.ticks.every((t) => !t.label.includes('m')))

  const smallScale = computeChartScale(1500) // 25 min
  assert.ok(smallScale.maxSeconds >= 1500)
  assert.ok(smallScale.ticks.every((t) => !t.label.includes('m')))
  assert.ok(smallScale.ticks.some((t) => t.label.includes('분')))

  const largeScale = computeChartScale(7500) // 2h 5m
  assert.ok(largeScale.maxSeconds >= 7500)
  assert.ok(largeScale.ticks.every((t) => !t.label.includes('m')))
  assert.ok(largeScale.ticks.some((t) => t.label.includes('시간')))
})

test('resolveSummaryDisplay switches to connection time and camera guidance when camera time is 0', () => {
  const now = Date.parse('2026-11-23T15:00:00+09:00')
  const range = getRecordRange('week', now, 0)

  const camOffRecords = [
    makeRecord({ id: '1', studySeconds: 1500, cameraFocus: undefined }),
    makeRecord({ id: '2', studySeconds: 900, cameraFocus: undefined }),
  ]
  const camOffSummary = resolveSummaryDisplay(camOffRecords, range, true)
  assert.equal(camOffSummary.isCameraFallback, true)
  assert.equal(camOffSummary.primaryLabel, '이번 주 연결 시간')
  assert.equal(camOffSummary.primarySeconds, 2400)
  assert.equal(camOffSummary.secondaryCaption, '카메라를 켜면 함께한 시간이 쌓여요')
  assert.equal(camOffSummary.sessions, 2)

  const camOnRecords = [
    makeRecord({
      id: '3',
      studySeconds: 1500,
      cameraFocus: { observedMs: 1500_000, focusedMs: 1380_000, returns: 1 },
    }),
    makeRecord({ id: '4', studySeconds: 600, cameraFocus: undefined }),
  ]
  const mixedSummary = resolveSummaryDisplay(camOnRecords, range, true)
  assert.equal(mixedSummary.isCameraFallback, false)
  assert.equal(mixedSummary.primaryLabel, '이번 주 함께한 시간')
  assert.equal(mixedSummary.primarySeconds, 1380)
  assert.equal(mixedSummary.secondaryCaption, '연결 시간 35분')
  assert.equal(mixedSummary.sessions, 2)

  const pastRange = getRecordRange('week', now, -1)
  const pastSummary = resolveSummaryDisplay(camOnRecords, pastRange, false)
  assert.equal(pastSummary.primaryLabel, `${pastRange.dateLabel} 함께한 시간`)
})

test('buildCalendarData and buildBarChartData match exact slot counts for week, month, and year', () => {
  const now = Date.parse('2026-11-23T15:00:00+09:00')
  const rec = makeRecord({
    id: '10',
    endedAt: Date.parse('2026-11-23T14:00:00+09:00'),
    cameraFocus: { observedMs: 1500_000, focusedMs: 1380_000, returns: 0 },
  })

  const weekRange = getRecordRange('week', now, 0)
  const futureRec = makeRecord({
    id: '11',
    endedAt: Date.parse('2026-11-25T14:00:00+09:00'),
    cameraFocus: { observedMs: 1500_000, focusedMs: 1380_000, returns: 0 },
  })
  const weekCal = buildCalendarData([rec, futureRec], weekRange)
  const weekBar = buildBarChartData([rec], weekRange, true)
  assert.equal(weekCal.cells.length, 7)
  assert.equal(weekBar.buckets.length, 7)
  assert.ok(weekCal.cells.find((c) => c.key === '2026-11-23')!.level >= 1)
  // Future day cell must ALWAYS be disabled with level 0 regardless of records
  const futureCell = weekCal.cells.find((c) => c.key === '2026-11-25')!
  assert.equal(futureCell.disabled, true)
  assert.equal(futureCell.level, 0)

  const monthRange = getRecordRange('month', now, 0)
  const monthBar = buildBarChartData([rec], monthRange, true)
  assert.equal(monthBar.buckets.length, 30) // November has 30 days

  const yearRange = getRecordRange('year', now, 0)
  const yearCal = buildCalendarData([rec], yearRange)
  const yearBar = buildBarChartData([rec], yearRange, true)
  assert.equal(yearCal.cells.length, 12)
  assert.equal(yearBar.buckets.length, 12)
  assert.ok(yearCal.cells[10]!.level >= 1) // November = index 10
})
