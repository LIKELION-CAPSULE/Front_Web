import assert from 'node:assert/strict'
import test from 'node:test'
import { groupLockedVoices } from '../src/features/mates/my-mates-utils.ts'
import { formatNextStageCaption } from '../src/features/mates/affinity-progress.ts'
import { duration } from '../src/shared/lib/format.ts'


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
