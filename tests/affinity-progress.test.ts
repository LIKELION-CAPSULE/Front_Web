import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStageProgress } from '../src/features/mates/affinity-progress.ts'

test('returns null when relation or progress fields are absent', () => {
  assert.equal(resolveStageProgress(undefined), null)
  assert.equal(resolveStageProgress({}), null)
  assert.equal(resolveStageProgress({ stageSeconds: 600 }), null)
  assert.equal(resolveStageProgress({ stageTargetSeconds: 3600 }), null)
  assert.equal(resolveStageProgress({ stageSeconds: 600, stageTargetSeconds: 0 }), null)
  assert.equal(resolveStageProgress({ stageSeconds: 600, stageTargetSeconds: -10 }), null)
})

test('uses stageProgress directly for 0, 0.5, 1 and clamps out-of-range values', () => {
  assert.equal(resolveStageProgress({ stageProgress: 0 }), 0)
  assert.equal(resolveStageProgress({ stageProgress: 0.5 }), 0.5)
  assert.equal(resolveStageProgress({ stageProgress: 1 }), 1)
  assert.equal(resolveStageProgress({ stageProgress: -0.25 }), 0)
  assert.equal(resolveStageProgress({ stageProgress: 1.75 }), 1)
  assert.equal(resolveStageProgress({ stageProgress: Number.NaN }), null)
  assert.equal(resolveStageProgress({ stageProgress: Number.POSITIVE_INFINITY }), null)
})

test('computes and clamps ratio from stageSeconds and stageTargetSeconds', () => {
  assert.equal(resolveStageProgress({ stageSeconds: 0, stageTargetSeconds: 3600 }), 0)
  assert.equal(resolveStageProgress({ stageSeconds: 1800, stageTargetSeconds: 3600 }), 0.5)
  assert.equal(resolveStageProgress({ stageSeconds: 3600, stageTargetSeconds: 3600 }), 1)
  assert.equal(resolveStageProgress({ stageSeconds: -120, stageTargetSeconds: 3600 }), 0)
  assert.equal(resolveStageProgress({ stageSeconds: 7200, stageTargetSeconds: 3600 }), 1)
})

test('prefers stageProgress when both stageProgress and stageSeconds/stageTargetSeconds are present', () => {
  assert.equal(resolveStageProgress({ stageProgress: 0.25, stageSeconds: 1800, stageTargetSeconds: 3600 }), 0.25)
})

test('my-mates affinity view: stage, progress, next stage and the expressions it opens', async () => {
  const { affinityProgressView } = await import('../src/features/mates/affinity-progress.ts')
  const format = (seconds: number) => `${Math.round(seconds / 60)}분`
  const expressions = [
    { unlocked: true, unlockStage: 1 },
    { unlocked: false, unlockStage: 3 },
    { unlocked: false, unlockStage: 3 },
    { unlocked: false, unlockStage: 4 },
  ]
  const view = affinityProgressView(
    { stage: 2, stageName: '아는 사이', nextStageName: '친구', nextLevelSeconds: 1800, stageSeconds: 900, stageTargetSeconds: 3600 },
    expressions,
    5,
    format,
  )
  assert.equal(view.progress, 0.25)
  assert.equal(view.nextCaption, '친구까지 30분')
  assert.equal(view.nextUnlocks, 2)
  assert.equal(view.isLast, false)
  // Server data without stages on the expressions: the next stage's name in the condition.
  const byName = affinityProgressView(
    { stage: 2, stageName: '아는 사이', nextStageName: '친구' },
    [{ unlocked: false, condition: '친구 단계에서 열려요' }, { unlocked: false, condition: '단짝 단계에서 열려요' }],
    5,
    format,
  )
  assert.equal(byName.nextUnlocks, 1)
  assert.equal(byName.nextCaption, null)
  assert.equal(byName.progress, null)
  assert.equal(affinityProgressView({ stage: 5, stageName: '단짝' }, [], 5, format).isLast, true)
})
