import test from 'node:test'
import assert from 'node:assert/strict'
import { INITIAL_PHOTO_TAP_STATE, registerPhotoTap } from '../src/features/auth/login-backgrounds/desktop/photo-unlock.ts'

const config = { tapGapMs: 1200, peekAt: 4, openAt: 6 }

function tapSeries(times: number[]) {
  let state = INITIAL_PHOTO_TAP_STATE
  return times.map((t) => {
    const result = registerPhotoTap(state, t, config)
    state = result.state
    return result.stage
  })
}

test('six quick taps reach peek on the 4th and open on the 6th', () => {
  assert.deepEqual(tapSeries([0, 200, 400, 600, 800, 1000]), ['none', 'none', 'none', 'peek', 'none', 'open'])
})

test('a pause longer than the gap restarts the count', () => {
  assert.deepEqual(tapSeries([0, 200, 400, 2000, 2200, 2400, 2600]), ['none', 'none', 'none', 'none', 'none', 'none', 'peek'])
})

test('after opening, the count starts over', () => {
  const stages = tapSeries([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
  assert.equal(stages[5], 'open')
  assert.equal(stages[9], 'peek')
})
