import assert from 'node:assert/strict'
import test from 'node:test'
import { flipTransform, GRID_MORPH_MS, gridMotion } from '../src/features/records/grid-morph.ts'
import { BOARD_MORPH_MS } from '../src/features/records/capsule-board/capsule-board-view.ts'

test('grid motion: another period morphs, the same period moved slides with time, the same days stay still', () => {
  const week = { mode: 'week', firstKey: '2026-11-23', lastKey: '2026-11-29' } as const
  assert.equal(gridMotion(null, week), 'none', 'the first draw does not move')
  assert.equal(gridMotion(week, { mode: 'month', firstKey: '2026-11-01', lastKey: '2026-11-30' }), 'morph')
  assert.equal(gridMotion({ mode: 'year', firstKey: '2026-01-01', lastKey: '2026-12-31' }, { mode: 'month', firstKey: '2026-11-01', lastKey: '2026-11-30' }), 'morph')
  assert.equal(gridMotion(week, { mode: 'week', firstKey: '2026-11-16', lastKey: '2026-11-22' }), 'slide-previous')
  assert.equal(gridMotion({ mode: 'week', firstKey: '2026-11-16', lastKey: '2026-11-22' }, week), 'slide-next')
  assert.equal(gridMotion(week, { ...week }), 'none', 'new records or another mate')
  assert.equal(GRID_MORPH_MS, BOARD_MORPH_MS, 'the same length as the 2.5D board’s morph')
})

test('FLIP: the inverse transform puts a cell back at its old box (origin top-left)', () => {
  assert.equal(flipTransform({ x: 10, y: 20, w: 100, h: 100 }, { x: 40, y: 60, w: 20, h: 20 }), 'translate(-30px, -40px) scale(5, 5)')
  assert.equal(flipTransform({ x: 0, y: 0, w: 18, h: 18 }, { x: 0, y: 0, w: 76, h: 76 }), 'translate(0px, 0px) scale(0.237, 0.237)')
  assert.equal(flipTransform({ x: 5, y: 5, w: 10, h: 10 }, { x: 5, y: 5, w: 0, h: 0 }), 'translate(0px, 0px) scale(1, 1)')
})
