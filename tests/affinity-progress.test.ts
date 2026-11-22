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
