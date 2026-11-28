import assert from 'node:assert/strict'
import test from 'node:test'
import { fitRecentRows, RECENT_ROW } from '../src/features/mates/components/recent-rows.ts'

test('내 메이트 recent rows: as many as fit at the smallest height, then sharing the room (no empty row-sized gap)', () => {
  // 1440 × 930 (room 78): two rows of 38 instead of one row and ~40px of nothing.
  assert.deepEqual(fitRecentRows(78, 10), { rows: 2, height: 38 })
  // 1440 × 900 (room 48): one row filling it.
  assert.deepEqual(fitRecentRows(48, 10), { rows: 1, height: 48 })
  // 1280 × 800 (room 64): two rows need 69 — one row, no taller than the largest row height.
  assert.deepEqual(fitRecentRows(64, 10), { rows: 1, height: RECENT_ROW.max })
  // Narrow screens' fixed room (163): four rows of 40, as before.
  assert.deepEqual(fitRecentRows(163, 10), { rows: 4, height: 40 })
})

test('내 메이트 recent rows: at least one row and never more than the maximum; rows never shorter than the smallest height', () => {
  assert.deepEqual(fitRecentRows(0, 10), { rows: 1, height: RECENT_ROW.min })
  assert.equal(fitRecentRows(2000, 10).rows, 10)
  for (let height = 0; height <= 400; height++) {
    const { rows, height: each } = fitRecentRows(height, 10)
    assert.ok(each >= RECENT_ROW.min && each <= RECENT_ROW.max)
    if (rows > 1) assert.ok(rows * each + (rows - 1) * RECENT_ROW.rule <= height, `${height}: rows fit`)
  }
})
