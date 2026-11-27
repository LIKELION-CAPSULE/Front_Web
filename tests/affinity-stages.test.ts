import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAffinityStage } from '../src/features/mates/affinity-stages.ts'

test('a stage sent without names (37 relation of a mate met once) takes the table names', () => {
  // The production 37 entry: { stage: 1, stageName: null, nextStageName: null, nextStageSeconds: 3600, stageProgress: 0 }
  assert.deepEqual(normalizeAffinityStage(1, null, null), { stage: 1, stageName: '처음 만남', nextStageName: '아는 사이' })
  assert.deepEqual(normalizeAffinityStage(3, '  ', undefined), { stage: 3, stageName: '친구', nextStageName: '친한 친구' })
  // 21 stageUp · 22 record pass no next name: the table's.
  assert.deepEqual(normalizeAffinityStage(2, undefined), { stage: 2, stageName: '아는 사이', nextStageName: '친구' })
})

test('names the server sends stay the server\'s', () => {
  assert.deepEqual(normalizeAffinityStage(1, '처음 만남', '아는 사이'), { stage: 1, stageName: '처음 만남', nextStageName: '아는 사이' })
  // A known name decides the number.
  assert.deepEqual(normalizeAffinityStage(2, '친구', '친한 친구'), { stage: 3, stageName: '친구', nextStageName: '친한 친구' })
  // An unknown name is kept, as is a sent next name.
  assert.deepEqual(normalizeAffinityStage(2, '친한 사이', '특별한 사이'), { stage: 2, stageName: '친한 사이', nextStageName: '특별한 사이' })
  // A sent name with no next name: the table fills only the next one.
  assert.deepEqual(normalizeAffinityStage(1, '처음 만남', null), { stage: 1, stageName: '처음 만남', nextStageName: '아는 사이' })
})

test('no name and a stage off the table (or none): null', () => {
  assert.equal(normalizeAffinityStage(undefined, undefined), null)
  assert.equal(normalizeAffinityStage(null, null, null), null)
  assert.equal(normalizeAffinityStage(0, null, null), null)
  assert.equal(normalizeAffinityStage(6, null, null), null)
  assert.equal(normalizeAffinityStage(-1, undefined), null)
  assert.equal(normalizeAffinityStage(1.5, null), null)
  assert.equal(normalizeAffinityStage(Number.NaN, null), null)
})

test('the last stage has no next stage', () => {
  assert.deepEqual(normalizeAffinityStage(5, null, null), { stage: 5, stageName: '단짝', nextStageName: null })
  assert.deepEqual(normalizeAffinityStage(5, '단짝', null), { stage: 5, stageName: '단짝', nextStageName: null })
})
