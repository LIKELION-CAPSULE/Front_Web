import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSummaryDisplay } from '../src/features/reports/records-view-utils.ts'
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

test('resolveSummaryDisplay always leads with connection time as 함께한 시간 and keeps camera time secondary', () => {
  const now = Date.parse('2026-11-23T15:00:00+09:00')
  const range = getRecordRange('week', now, 0)

  const camOffRecords = [
    makeRecord({ id: '1', studySeconds: 1500, cameraFocus: undefined }),
    makeRecord({ id: '2', studySeconds: 900, cameraFocus: undefined }),
  ]
  const camOffSummary = resolveSummaryDisplay(camOffRecords, range, true)
  assert.equal(camOffSummary.primaryLabel, '이번 주 함께한 시간')
  assert.equal(camOffSummary.primarySeconds, 2400)
  assert.equal(camOffSummary.cameraCaption, null)
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
  assert.equal(mixedSummary.primaryLabel, '이번 주 함께한 시간')
  assert.equal(mixedSummary.primarySeconds, 2100)
  assert.equal(mixedSummary.cameraSeconds, 1380)
  assert.equal(mixedSummary.cameraCaption, '카메라로 함께한 시간 23분')
  assert.equal(mixedSummary.sessions, 2)

  const pastRange = getRecordRange('week', now, -1)
  const pastSummary = resolveSummaryDisplay(camOnRecords, pastRange, false)
  assert.equal(pastSummary.primaryLabel, `${pastRange.dateLabel} 함께한 시간`)
})

