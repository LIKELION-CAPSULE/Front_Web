import test from 'node:test'
import assert from 'node:assert/strict'
import { PresenceClock } from '../src/features/backend/presence-clock.ts'

const epoch = Date.parse('2026-11-05T01:00:00Z')
const at = (seconds: number) => epoch + seconds * 1000

test('the first face sends PRESENT once; brief face loss sends nothing', () => {
  const clock = new PresenceClock()
  assert.deepEqual(clock.sample(0, at(0), 'present'), [{ type: 'PRESENT', occurredAt: new Date(at(0)).toISOString() }])
  assert.deepEqual(clock.sample(10, at(10), 'absent'), [])
  assert.deepEqual(clock.sample(19, at(19), 'present'), [])
  assert.deepEqual(clock.totals(20), { connectedSeconds: 20, cameraOnSeconds: 19, presentSeconds: 19, pipSeconds: 0, awaySeconds: 0, returns: 0 })
})

test('ten continuous seconds emit AWAY at the first missing frame and count one return', () => {
  const clock = new PresenceClock()
  clock.sample(0, at(0), 'present')
  clock.sample(10, at(10), 'absent')
  assert.deepEqual(clock.sample(20, at(20), 'absent'), [{ type: 'AWAY', occurredAt: new Date(at(10)).toISOString() }])
  assert.deepEqual(clock.sample(23, at(23), 'absent'), [])
  assert.equal(clock.sample(25, at(25), 'present')[0]?.type, 'RETURN')
  clock.sample(30, at(30), 'present')
  const totals = clock.totals(30)
  assert.equal(totals.cameraOnSeconds, 30)
  assert.equal(totals.presentSeconds, 15)
  assert.equal(totals.returns, 1)
})

test('camera off never sends AWAY, closes an absence, and the next face is PRESENT again', () => {
  const clock = new PresenceClock()
  clock.sample(0, at(0), 'present')
  clock.sample(5, at(5), 'absent')
  clock.sample(15, at(15), 'absent')
  assert.deepEqual(clock.sample(20, at(20), 'off'), [])
  assert.deepEqual(clock.sample(40, at(40), 'off'), [])
  assert.equal(clock.sample(41, at(41), 'present')[0]?.type, 'PRESENT')
  const totals = clock.totals(41)
  assert.equal(totals.cameraOnSeconds, 20, 'camera-off time is not camera time')
  assert.equal(totals.presentSeconds, 5)
  assert.equal(totals.returns, 0)
})

test('an inference interruption restarts the unconfirmed ten-second window', () => {
  const clock = new PresenceClock()
  clock.sample(0, at(0), 'absent')
  clock.sample(9, at(9), 'unknown')
  assert.deepEqual(clock.sample(20, at(20), 'absent'), [])
  assert.deepEqual(clock.sample(29, at(29), 'absent'), [])
  assert.equal(clock.sample(30, at(30), 'absent')[0]?.type, 'AWAY')
})

test('totals always satisfy present ≤ cameraOn ≤ connected and pip ≤ connected (API 21 · 22 check)', () => {
  const clock = new PresenceClock({ presentSeconds: 500, cameraOnSeconds: 90, pipSeconds: 1000 })
  clock.sample(100, at(0), 'present', true, true)
  clock.sample(110, at(10), 'present', true, true)
  for (const connected of [0, 5, 100, 110.9]) {
    const totals = clock.totals(connected)
    assert.ok(totals.presentSeconds <= totals.cameraOnSeconds && totals.cameraOnSeconds <= totals.connectedSeconds, JSON.stringify(totals))
    assert.ok(totals.pipSeconds <= totals.connectedSeconds)
    assert.ok(Number.isInteger(totals.presentSeconds) && Number.isInteger(totals.cameraOnSeconds) && Number.isInteger(totals.pipSeconds))
  }
  assert.deepEqual(clock.totals(110), { connectedSeconds: 110, cameraOnSeconds: 100, presentSeconds: 100, pipSeconds: 110, awaySeconds: 0, returns: 0 })
})

test('a resumed connection continues from the server totals', () => {
  const clock = new PresenceClock({ presentSeconds: 30, cameraOnSeconds: 40, pipSeconds: 5 })
  clock.sample(60, at(0), 'present', true, true)
  clock.sample(70, at(10), 'present', true, false)
  assert.deepEqual(clock.totals(70), { connectedSeconds: 70, cameraOnSeconds: 50, presentSeconds: 40, pipSeconds: 15, awaySeconds: 0, returns: 0 })
})

test('time spent paused never completes the ten-second absence window or counts as camera time', () => {
  const clock = new PresenceClock()
  clock.sample(0, at(0), 'absent')
  assert.deepEqual(clock.sample(5, at(5), 'absent', false), [])
  assert.deepEqual(clock.sample(5, at(105), 'absent', false), [])
  assert.deepEqual(clock.sample(5, at(105), 'absent'), [])
  assert.deepEqual(clock.sample(14, at(114), 'absent'), [])
  assert.equal(clock.sample(15, at(115), 'absent')[0]?.type, 'AWAY')
})

test('a long unknown stretch is camera time but never face time', () => {
  const clock = new PresenceClock()
  clock.sample(0, at(0), 'present')
  clock.sample(10, at(10), 'unknown')
  clock.sample(600, at(600), 'unknown')
  clock.sample(610, at(610), 'present')
  const totals = clock.totals(610)
  assert.equal(totals.cameraOnSeconds, 610)
  assert.equal(totals.presentSeconds, 10, 'only the seen seconds')
})

test('the 10-second grace counts as present when the face returns, and is dropped retroactively once AWAY is confirmed', () => {
  const brief = new PresenceClock()
  brief.sample(0, at(0), 'present')
  brief.sample(5, at(5), 'absent')
  brief.sample(14, at(14), 'present')
  assert.equal(brief.totals(14).presentSeconds, 14, '9 s unseen within the grace still counts')
  const away = new PresenceClock()
  away.sample(0, at(0), 'present')
  away.sample(5, at(5), 'absent')
  assert.deepEqual(away.sample(15, at(15), 'absent'), [{ type: 'AWAY', occurredAt: new Date(at(5)).toISOString() }], 'dated when last seen')
  away.sample(40, at(40), 'present')
  const totals = away.totals(40)
  assert.equal(totals.presentSeconds, 5, 'nothing from 5 s on')
  assert.equal(totals.awaySeconds, 35)
  const dropped = new PresenceClock()
  dropped.sample(0, at(0), 'present')
  dropped.sample(5, at(5), 'absent')
  dropped.sample(9, at(9), 'unknown')
  dropped.sample(12, at(12), 'present')
  assert.equal(dropped.totals(12).presentSeconds, 5, 'a grace interrupted by unknown is not presence')
})
