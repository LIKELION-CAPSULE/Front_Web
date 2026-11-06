import assert from 'node:assert/strict'
import test from 'node:test'
import { preparePosterBounds, prepareHalftoneProgress, prepareHalftoneReveal } from '../src/features/session/prepare-halftone.ts'
import { DOT_FORM_START_MS, DOT_FORM_END_MS } from '../src/features/session/prepare-capsule-motion.ts'

test('the entire poster fits inside portrait, square and landscape forms with its original aspect ratio', () => {
  for (const [width, height] of [[720, 783], [342, 780], [720, 294], [400, 400]]) {
    for (const [sourceWidth, sourceHeight] of [[1024, 1536], [1536, 1024]]) {
      const fit = preparePosterBounds(sourceWidth!, sourceHeight!, width!, height!)
      assert.ok(fit.x >= 0 && fit.y >= 0)
      assert.ok(fit.x + fit.width <= width! + 1e-8 && fit.y + fit.height <= height! + 1e-8)
      assert.ok(Math.abs(fit.width / fit.height - sourceWidth! / sourceHeight!) < 1e-8)
      assert.ok(Math.abs(fit.width - width!) < 1e-8 || Math.abs(fit.height - height!) < 1e-8)
      assert.ok(Math.abs(fit.x - (width! - fit.x - fit.width)) < 1e-8)
      assert.ok(Math.abs(fit.y - (height! - fit.y - fit.height)) < 1e-8)
    }
  }
})

test('halftone conversion travels from top-left through the center to bottom-right', () => {
  assert.equal(prepareHalftoneProgress(DOT_FORM_START_MS), 0)
  assert.equal(prepareHalftoneProgress(DOT_FORM_END_MS), 1)
  const middle = prepareHalftoneProgress((DOT_FORM_START_MS + DOT_FORM_END_MS) / 2)
  assert.equal(prepareHalftoneReveal(middle, .1, .1), 1)
  assert.ok(Math.abs(prepareHalftoneReveal(middle, .5, .5) - .5) < 1e-8)
  assert.equal(prepareHalftoneReveal(middle, .9, .9), 0)
  assert.equal(prepareHalftoneReveal(middle, .2, .8), prepareHalftoneReveal(middle, .8, .2))
})

test('every point reveals monotonically and completes before the burst without an endpoint flash', () => {
  for (const x of [0, .1, .5, .9, 1]) for (const y of [0, .1, .5, .9, 1]) {
    assert.equal(prepareHalftoneReveal(0, x, y), 0)
    assert.equal(prepareHalftoneReveal(1, x, y), 1)
    let previous = 0
    for (let step = 0; step <= 100; step++) {
      const reveal = prepareHalftoneReveal(step / 100, x, y)
      assert.ok(reveal >= previous && reveal >= 0 && reveal <= 1)
      previous = reveal
    }
  }
})
