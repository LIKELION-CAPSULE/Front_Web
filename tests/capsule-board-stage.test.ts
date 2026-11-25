import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BOARD_MORPH_MS,
  BOARD_STAGE_LIMITS,
  boardStageAspect,
  boardStageCap,
  boardStageRatio,
} from '../src/features/records/capsule-board/capsule-board-view.ts'

const css = readFileSync(new URL('../src/features/records/capsule-board/capsule-board.css', import.meta.url), 'utf8')
const pageCss = readFileSync(new URL('../src/features/reports/records-window.css', import.meta.url), 'utf8')

test('the stage height eases with the period morph instead of jumping (same time, same curve)', () => {
  // The ratio (height / width) is what transitions: registered as a number, inherited by the stage.
  assert.match(css, /@property --board-ratio \{\s*syntax: '<number>';\s*inherits: true;/)
  assert.match(css, /aspect-ratio: 1 \/ var\(--board-ratio/)
  const transition = css.match(/transition: --board-ratio (\d+)ms (cubic-bezier\([^)]*\))/)
  assert.ok(transition, 'the ratio transitions')
  assert.equal(Number(transition[1]), BOARD_MORPH_MS)
  // easeInOutCubic, the scene's easeInOut.
  assert.equal(transition[2], 'cubic-bezier(0.65, 0, 0.35, 1)')
  // The narrow year's cap moves with it.
  assert.match(css, new RegExp(`transition: max-height ${BOARD_MORPH_MS}ms cubic-bezier\\(0\\.65, 0, 0\\.35, 1\\)`))
  // Reduced motion: at once.
  assert.match(css, /\.capsule-board\[data-reduced-motion\],\s*\.capsule-board\[data-reduced-motion\] \.capsule-board-stage \{\s*transition: none;/)
})

test('the stage ratio holds the height limits, so the eased height runs the whole morph', () => {
  // Without a size: the board's own shape.
  for (const narrow of [false, true]) {
    for (const mode of ['week', 'month', 'year'] as const) {
      for (const view of ['2d', '25d'] as const) {
        assert.ok(Math.abs(boardStageRatio(mode, view, narrow) * boardStageAspect(mode, view, narrow) - 1) < 1e-12)
      }
    }
  }
  // The limits are the stylesheet's.
  const { min, max, floor, chrome, narrowYearMax } = BOARD_STAGE_LIMITS
  assert.match(css, new RegExp(`min-height: ${min}px;`))
  assert.match(css, new RegExp(`max-height: min\\(${max}px, max\\(${floor}px, calc\\(100vh - ${chrome}px\\)\\)\\);`))
  assert.match(css, new RegExp(`max-height: ${narrowYearMax}px;`))
  assert.equal(boardStageCap(900, 'month', false), 520)
  assert.equal(boardStageCap(720, 'week', false), 340)
  assert.equal(boardStageCap(600, 'week', false), 320)
  assert.equal(boardStageCap(1400, 'week', false), 600)
  assert.equal(boardStageCap(900, 'year', true), 1100)

  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const frames = Math.ceil(BOARD_MORPH_MS / (1000 / 60))
  // 1440 × 900: the stage is 1168 px wide.
  const size = { width: 1168, viewportHeight: 900 }
  const cases = [
    { from: ['week', '25d'], to: ['month', '25d'], heights: [487, 520] },
    { from: ['week', '2d'], to: ['month', '2d'], heights: [344, 520] },
    { from: ['week', '2d'], to: ['week', '25d'], heights: [344, 487] },
    { from: ['month', '25d'], to: ['year', '2d'], heights: [520, 520] },
  ] as const
  for (const { from, to, heights } of cases) {
    const r0 = boardStageRatio(from[0], from[1], false, size)
    const r1 = boardStageRatio(to[0], to[1], false, size)
    // The ratio is what the stage shows, limits included: no clamp left for the stylesheet to apply.
    assert.equal(Math.round(r0 * size.width), heights[0], `${from} height`)
    assert.equal(Math.round(r1 * size.width), heights[1], `${to} height`)
    const heightAt = (t: number) => size.width * (r0 + (r1 - r0) * easeInOut(t))
    let moving = 0
    for (let frame = 1; frame <= frames; frame++) {
      const step = Math.abs(heightAt(frame / frames) - heightAt((frame - 1) / frames))
      if (step > 0.05) moving++
      // Eased over the whole morph: never more than about 3× the average step (ease-in-out cubic peak), so no jump.
      assert.ok(step <= (3.1 * Math.abs(heights[1] - heights[0])) / frames + 1e-9, `${from}→${to} frame ${frame}: ${step}`)
    }
    // The height keeps changing over (nearly) the whole morph, not only until a limit is reached.
    if (heights[0] !== heights[1]) assert.ok(moving >= frames * 0.8, `${from}→${to}: moving ${moving}/${frames}`)
  }
  // 1280 × 720: week and month both fill the capped 340 px stage — nothing moves.
  const small = { width: 1008, viewportHeight: 720 }
  assert.equal(Math.round(boardStageRatio('week', '25d', false, small) * small.width), 340)
  assert.equal(Math.round(boardStageRatio('month', '25d', false, small) * small.width), 340)
})

test('the selected day folds away in the year with the morph, instead of leaving the block at once', () => {
  assert.match(pageCss, new RegExp(`\\.records-day-detail-slot \\{\\s*display: grid;\\s*grid-template-rows: 1fr;\\s*transition: grid-template-rows ${BOARD_MORPH_MS}ms cubic-bezier\\(0\\.65, 0, 0\\.35, 1\\);`))
  assert.match(pageCss, /\.records-day-detail-slot\[data-collapsed\] \{\s*grid-template-rows: 0fr;/)
  assert.match(pageCss, /\.records-day-detail-slot-inner \{\s*min-height: 0;\s*overflow: hidden;/)
  assert.match(pageCss, /@media \(prefers-reduced-motion: reduce\) \{\s*\.records-day-detail-slot \{\s*transition: none;/)
})
