import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countMateUnlocks,
  formatFirstMetDate,
  groupLockedVoices,
  summarizeMateRecords,
  type MateUnlocks,
} from '../src/features/mates/my-mates-utils.ts'
import { formatNextStageCaption } from '../src/features/mates/affinity-progress.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { duration } from '../src/shared/lib/format.ts'

function makeRecord(overrides: Partial<StudyRecord> & { id: string }): StudyRecord {
  const endedAt = overrides.endedAt ?? Date.UTC(2026, 10, 22, 12, 0, 0)
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
      relation: {
        stageName: '친구',
        stageProgress: 0.4,
        nextStageName: '친한 친구',
        nextLevelSeconds: 10800,
      },
    },
    ...overrides,
  }
}

test('summarizeMateRecords aggregates camera togetherSeconds, server-report count, and earliest date per mate', () => {
  const day1 = Date.UTC(2026, 10, 17, 1, 0, 0) // 2026-11-17 10:00 KST
  const day2 = Date.UTC(2026, 10, 20, 1, 0, 0)
  const day3 = Date.UTC(2026, 10, 22, 1, 0, 0)

  const records: StudyRecord[] = [
    makeRecord({
      id: '9001',
      startedAt: day2 - 1500_000,
      endedAt: day2,
      cameraFocus: { observedMs: 1500_000, focusedMs: 1200_000, returns: 1 },
    }),
    makeRecord({
      id: '9002',
      startedAt: day1 - 1800_000,
      endedAt: day1,
      cameraFocus: { observedMs: 1800_000, focusedMs: 1800_000, returns: 0 },
    }),
    // Record without cameraFocus still counts toward connectionCount
    makeRecord({
      id: '9003',
      startedAt: day3 - 900_000,
      endedAt: day3,
      cameraFocus: undefined,
    }),
    // Record for a different mate must be ignored
    makeRecord({
      id: '9999',
      characterIds: ['202'],
      startedAt: Date.UTC(2026, 9, 1, 0, 0, 0),
      endedAt: Date.UTC(2026, 9, 1, 1, 0, 0),
      cameraFocus: { observedMs: 3600_000, focusedMs: 3600_000, returns: 0 },
    }),
    // Record without serverReport must be ignored
    makeRecord({
      id: 'local-only',
      serverReport: undefined,
      cameraFocus: { observedMs: 600_000, focusedMs: 600_000, returns: 0 },
    }),
  ]

  const summary = summarizeMateRecords(records, '201')
  assert.equal(summary.togetherSeconds, 3000) // 1200 + 1800
  assert.equal(summary.connectionCount, 3)
  assert.equal(summary.firstMetAt, day1 - 1800_000)
  assert.equal(formatFirstMetDate(summary.firstMetAt!), '2026.11.17')
  assert.deepEqual(
    summary.recentRecords.map((r) => r.id),
    ['9003', '9001', '9002'],
  )
  assert.equal(summary.hasMoreRecords, false)
})

test('summarizeMateRecords returns nulls for empty or zero values and prefers server stats when present', () => {
  const empty = summarizeMateRecords([], '201')
  assert.equal(empty.togetherSeconds, null)
  assert.equal(empty.connectionCount, null)
  assert.equal(empty.firstMetAt, null)
  assert.equal(empty.recentRecords.length, 0)
  assert.equal(empty.hasMoreRecords, false)

  const noCam = summarizeMateRecords([makeRecord({ id: '9001', cameraFocus: undefined })], '201')
  assert.equal(noCam.togetherSeconds, null)
  assert.equal(noCam.connectionCount, 1)

  const overridden = summarizeMateRecords(
    [makeRecord({ id: '9001', cameraFocus: { observedMs: 600_000, focusedMs: 600_000, returns: 0 } })],
    '201',
    {
      togetherSeconds: 7200,
      connectionCount: 12,
      firstMetAt: Date.UTC(2026, 8, 5, 3, 0, 0),
      stageName: '단짝',
      stageProgress: 0.75,
    },
  )
  assert.equal(overridden.togetherSeconds, 7200)
  assert.equal(overridden.connectionCount, 12)
  assert.equal(formatFirstMetDate(overridden.firstMetAt!), '2026.09.05')
  assert.equal(overridden.relation?.stageName, '단짝')
  assert.equal(overridden.relation?.stageProgress, 0.75)
})

test('summarizeMateRecords caps recentRecords at 5 and sets hasMoreRecords when > 5', () => {
  const base = Date.UTC(2026, 10, 22, 12, 0, 0)
  const seven = Array.from({ length: 7 }, (_, i) =>
    makeRecord({ id: String(9001 + i), endedAt: base - i * 86_400_000 }),
  )
  const summary = summarizeMateRecords(seven, '201')
  assert.equal(summary.totalRecordCount, 7)
  assert.equal(summary.recentRecords.length, 5)
  assert.equal(summary.hasMoreRecords, true)
  assert.equal(summary.recentRecords[0]?.id, '9001')
  assert.equal(summary.recentRecords[4]?.id, '9005')
})

test('countMateUnlocks counts unlocked and total across expressions and voices, returning null when absent/empty', () => {
  assert.equal(countMateUnlocks(undefined), null)
  assert.equal(countMateUnlocks(null), null)
  assert.equal(countMateUnlocks({ expressions: [], voices: [] }), null)

  const unlocks: MateUnlocks = {
    expressions: [
      { id: 'e1', label: '미소', expressionFile: 'files/009.exp3.json', unlocked: true },
      { id: 'e2', label: '웃음', expressionFile: 'files/010.exp3.json', unlocked: true },
      { id: 'e3', label: '놀람', expressionFile: 'files/006.exp3.json', unlocked: false },
      { id: 'e4', label: '눈감음', expressionFile: 'files/005.exp3.json', unlocked: false },
    ],
    voices: [
      { id: 'v1', text: '안녕', unlocked: true },
      { id: 'v2', text: '', unlocked: false },
      { id: 'v3', text: '', unlocked: false },
      { id: 'v4', text: '', unlocked: false },
      { id: 'v5', text: '', unlocked: false },
      { id: 'v6', text: '', unlocked: false },
      { id: 'v7', text: '', unlocked: false },
      { id: 'v8', text: '', unlocked: false },
    ],
  }
  assert.deepEqual(countMateUnlocks(unlocks), { unlocked: 3, total: 12 })
})

test('formatNextStageCaption formats remaining time with nextStageName or fallback', () => {
  assert.equal(formatNextStageCaption(undefined, duration), null)
  assert.equal(formatNextStageCaption({ nextLevelSeconds: 0 }, duration), null)
  assert.equal(
    formatNextStageCaption({ nextStageName: '친한 친구', nextLevelSeconds: 10800 }, duration),
    '친한 친구까지 3시간',
  )
  assert.equal(
    formatNextStageCaption({ nextLevelSeconds: 1800 }, duration),
    '다음 단계까지 30분',
  )
})

test('groupLockedVoices groups identical conditions, splits different ones in order, falls back when empty, and ignores unlocked items', () => {
  const result = groupLockedVoices([
    { id: 'v1', text: '열린 대사 1', unlocked: true, condition: '친한 친구 단계에서 열려요' },
    { id: 'v2', text: '', unlocked: false, condition: '친한 친구 단계에서 열려요' },
    { id: 'v3', text: '', unlocked: false, condition: '친한 친구 단계에서 열려요' },
    { id: 'v4', text: '열린 대사 2', unlocked: true },
    { id: 'v5', text: '', unlocked: false, condition: '단짝 단계에서 열려요' },
    { id: 'v6', text: '', unlocked: false, condition: '단짝 단계에서 열려요' },
    { id: 'v7', text: '', unlocked: false },
    { id: 'v8', text: '', unlocked: false, condition: '   ' },
  ])

  assert.deepEqual(result, [
    {
      condition: '친한 친구 단계에서 열려요',
      count: 2,
      label: '친한 친구 단계에서 2개가 열려요',
    },
    {
      condition: '단짝 단계에서 열려요',
      count: 2,
      label: '단짝 단계에서 2개가 열려요',
    },
    {
      condition: '',
      count: 2,
      label: '아직 열리지 않았어요',
    },
  ])
})
