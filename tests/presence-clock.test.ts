import test from 'node:test'
import assert from 'node:assert/strict'
import { PresenceClock } from '../src/features/backend/presence-clock.ts'

const epoch = Date.parse('2026-11-05T01:00:00Z')

test('brief face loss never creates an away event or subtracts study time', () => {
  const clock = new PresenceClock()
  assert.deepEqual(clock.sample(10, epoch + 10_000, 'absent', 'study'), [])
  assert.deepEqual(clock.sample(19, epoch + 19_000, 'present', 'study'), [])
  assert.equal(clock.totals(20).presentSeconds, 20)
})

test('ten continuous seconds emit AWAY at the first missing frame and count one return', () => {
  const clock = new PresenceClock()
  clock.sample(10, epoch + 10_000, 'absent', 'study')
  assert.deepEqual(clock.sample(20, epoch + 20_000, 'absent', 'study'), [{ type: 'AWAY', occurredAt: new Date(epoch + 10_000).toISOString() }])
  assert.deepEqual(clock.sample(23, epoch + 23_000, 'absent', 'study'), [])
  assert.equal(clock.sample(25, epoch + 25_000, 'present', 'study')[0]?.type, 'RETURN')
  assert.equal(clock.totals(30).presentSeconds, 15)
  assert.equal(clock.totals(30).returns, 1)
})

test('breaks close an absence and resume with FOCUS without incrementing returns', () => {
  const clock = new PresenceClock()
  clock.sample(0, epoch, 'absent', 'study')
  clock.sample(10, epoch + 10_000, 'absent', 'study')
  assert.equal(clock.sample(15, epoch + 15_000, 'unknown', 'break')[0]?.type, 'BREAK')
  assert.deepEqual(clock.sample(15, epoch + 25_000, 'absent', 'break'), [])
  assert.equal(clock.sample(15, epoch + 30_000, 'present', 'study')[0]?.type, 'FOCUS')
  assert.equal(clock.totals(20).presentSeconds, 5)
  assert.equal(clock.totals(20).returns, 0)
})

test('camera off counts as presence and never invents a physical return', () => {
  const clock = new PresenceClock()
  assert.deepEqual(clock.sample(20, epoch + 20_000, 'off', 'study'), [])
  clock.sample(25, epoch + 25_000, 'absent', 'study')
  clock.sample(35, epoch + 35_000, 'absent', 'study')
  assert.equal(clock.sample(40, epoch + 40_000, 'off', 'study')[0]?.type, 'FOCUS')
  assert.equal(clock.totals(50).presentSeconds, 35)
  assert.equal(clock.totals(50).returns, 0)
})

test('an inference interruption restarts the unconfirmed ten-second window', () => {
  const clock = new PresenceClock()
  clock.sample(0, epoch, 'absent', 'study')
  clock.sample(9, epoch + 9000, 'unknown', 'study')
  assert.deepEqual(clock.sample(20, epoch + 20_000, 'absent', 'study'), [])
  assert.deepEqual(clock.sample(29, epoch + 29_000, 'absent', 'study'), [])
  assert.equal(clock.sample(30, epoch + 30_000, 'absent', 'study')[0]?.type, 'AWAY')
})

test('a resumed session preserves known absence time and keeps totals within bounds', () => {
  const clock = new PresenceClock(30)
  assert.equal(clock.totals(100).presentSeconds, 70)
  assert.equal(clock.totals(5).presentSeconds, 0)
})

test('time spent in a confirmation pause never completes the ten-second absence window', () => {
  const clock = new PresenceClock()
  clock.sample(0, epoch, 'absent', 'study')
  assert.deepEqual(clock.sample(5, epoch + 5000, 'absent', 'study', false), [])
  assert.deepEqual(clock.sample(5, epoch + 105000, 'absent', 'study', false), [])
  assert.deepEqual(clock.sample(5, epoch + 105000, 'absent', 'study'), [])
  assert.deepEqual(clock.sample(14, epoch + 114000, 'absent', 'study'), [])
  assert.equal(clock.sample(15, epoch + 115000, 'absent', 'study')[0]?.type, 'AWAY')
})

test('pausing retains actual absence totals and resuming clears AWAY without a physical return', () => {
  const clock = new PresenceClock()
  clock.sample(10, epoch + 10000, 'absent', 'study')
  clock.sample(20, epoch + 20000, 'absent', 'study')
  assert.deepEqual(clock.sample(25, epoch + 25000, 'unknown', 'study', false), [])
  assert.deepEqual(clock.sample(25, epoch + 125000, 'off', 'study', false), [])
  assert.deepEqual(clock.sample(25, epoch + 125000, 'present', 'study'), [{ type: 'FOCUS', occurredAt: new Date(epoch + 125000).toISOString() }])
  assert.deepEqual(clock.totals(30), { studySeconds: 30, presentSeconds: 15, awaySeconds: 15, returns: 0 })
})
