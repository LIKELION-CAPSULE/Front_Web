import test from 'node:test'
import assert from 'node:assert/strict'
import { MINOR_LIMIT_RETRY_MS, minorDeadlineOf, minorLimitStep, type MinorLimitState } from '../src/features/mates/minor-limit.ts'

const fresh: MinorLimitState = { connectionId: null, warned: false, lastAttemptAt: null, attempts: 0 }

test('the under-19 deadline comes from the response time, not from when it was read', () => {
  assert.equal(minorDeadlineOf(600, '2026-11-25T10:00:00.000Z', 0, 0), Date.parse('2026-11-25T10:10:00.000Z'))
  assert.equal(minorDeadlineOf(600, '2026-11-25T10:00:00.000Z', 5000, 0), Date.parse('2026-11-25T10:09:55.000Z'), 'server clock 5 s ahead')
  assert.equal(minorDeadlineOf(null, '2026-11-25T10:00:00.000Z', 0, 0), null, 'adults have no limit')
  assert.equal(minorDeadlineOf(0, undefined, 0, 1000), 1000)
})

test('warns once at 10 minutes, ends once at zero, retries a failed end after a pause, never while one is on its way', () => {
  let step = minorLimitStep(fresh, { connectionId: '1', deadline: 1_000_000, now: 0, busy: false })
  assert.deepEqual([step.warn, step.end], [false, false])
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_000_000 - 600_000, busy: false })
  assert.deepEqual([step.warn, step.end], [true, false])
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_000_000 - 300_000, busy: false })
  assert.deepEqual([step.warn, step.end], [false, false], 'the warning shows once')
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_000_000, busy: false })
  assert.deepEqual([step.end, step.state.attempts], [true, 1])
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_000_500, busy: true })
  assert.equal(step.end, false, 'the hang-up is still on its way')
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_001_000, busy: false })
  assert.equal(step.end, false, 'too soon after a failed end')
  step = minorLimitStep(step.state, { connectionId: '1', deadline: 1_000_000, now: 1_000_000 + MINOR_LIMIT_RETRY_MS, busy: false })
  assert.deepEqual([step.end, step.state.attempts], [true, 2])
  const next = minorLimitStep(step.state, { connectionId: '2', deadline: null, now: 2_000_000, busy: false })
  assert.deepEqual([next.end, next.state.attempts], [false, 0], 'a new connection starts over')
  const zero = minorLimitStep(fresh, { connectionId: '3', deadline: 0, now: 0, busy: false })
  assert.deepEqual([zero.warn, zero.end], [false, true], 'already at zero on entry: no warning, straight to the end')
})
