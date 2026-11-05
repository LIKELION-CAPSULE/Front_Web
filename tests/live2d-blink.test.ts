import assert from 'node:assert/strict'
import test from 'node:test'
import { createBlinkState, stepBlink } from '../src/features/live2d/blink.ts'
import { BLINK_CLOSED_MS, BLINK_CLOSING_MS, BLINK_INTERVAL_MIN_MS, BLINK_OPENING_MS } from '../src/features/live2d/live2d-constants.ts'

test('a blink closes, holds, reopens, then waits for the next interval', () => {
  const zero = () => 0
  let state = createBlinkState(0, zero)
  const at = (now: number) => { const step = stepBlink(state, now, zero); state = step.state; return step.factor }
  assert.equal(at(BLINK_INTERVAL_MIN_MS - 1), 1)
  const start = BLINK_INTERVAL_MIN_MS
  assert.equal(at(start), 1)
  assert.equal(at(start + BLINK_CLOSING_MS / 2), 0.5)
  assert.equal(at(start + BLINK_CLOSING_MS), 0)
  assert.equal(at(start + BLINK_CLOSING_MS + BLINK_CLOSED_MS + BLINK_OPENING_MS / 2), 0.5)
  const end = start + BLINK_CLOSING_MS + BLINK_CLOSED_MS + BLINK_OPENING_MS
  assert.equal(at(end), 1)
  assert.equal(state.startedAt, null)
  assert.equal(state.nextAt, end + BLINK_INTERVAL_MIN_MS)
})
