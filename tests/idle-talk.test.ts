import assert from 'node:assert/strict'
import test from 'node:test'
import { IDLE_TALK_AFTER_MS, IdleTalkTimer, type IdleTalkInput } from '../src/features/backend/idle-talk.ts'

const S = 1000
const base: IdleTalkInput = { talk: 'often', live: true, busy: false, camera: true, away: false, visible: true }

/** Steps a fake clock second by second from `from` to `to` (inclusive); `at(t)` gives the input then. Returns the fire times. */
function run(timer: IdleTalkTimer, from: number, to: number, at: (t: number) => Partial<IdleTalkInput>, seen: Record<number, number | null> = {}) {
  const fired: number[] = []
  for (let t = from; t <= to; t++) {
    if (timer.step(t * S, { ...base, ...at(t) })) fired.push(t)
    seen[t] = timer.countingSince === null ? null : timer.countingSince / S
  }
  return fired
}

test('IDLE_TALK waits: 자주 1분, 가끔 3분, 조용히 never', () => {
  assert.deepEqual(IDLE_TALK_AFTER_MS, { often: 60_000, sometimes: 180_000, quiet: null })
})

test('the example flow: reply done → 1 min → IDLE_TALK → send stops it → away stops it → back → 1 min → IDLE_TALK', () => {
  const timer = new IdleTalkTimer()
  const seen: Record<number, number | null> = {}
  const fired = run(timer, -5, 320, (t) => {
    if (t < 0) return { busy: true }                 // 채린's reply (28) still coming in / typing
    if (t > 60 && t <= 63) return { busy: true }     // right after the call: her line (18 → 19) on its way, typing
    if (t >= 80 && t < 83) return { busy: true }     // 01:20 the user sends (28) … 01:23 the reply is done
    if (t >= 130 && t < 240) return { away: true }   // 02:10 AWAY (camera on) … 04:00 back
    if (t === 240) return { busy: true }             // 04:00 RETURN's line (19)
    return {}
  }, seen)
  // 01:00 the first call, 05:00 (a minute after the welcome back finished) the next.
  assert.deepEqual(fired, [60, 301])
  // The count starts over at each end of talk: after her line, after the reply, after the welcome back.
  assert.equal(seen[59], 0)
  assert.equal(seen[64], 64)
  assert.equal(seen[81], null)
  assert.equal(seen[84], 83)
  assert.equal(seen[131], null)   // away: stopped (the away call goes out on its own)
  assert.equal(seen[239], null)
  assert.equal(seen[242], 241)
})

test('a changed frequency applies at once; 조용히 stops and resets the count', () => {
  const timer = new IdleTalkTimer()
  // 가끔 for 100 s: nothing yet (3 minutes).
  assert.deepEqual(run(timer, 0, 100, () => ({ talk: 'sometimes' })), [])
  // Switched to 자주: already over a minute of quiet → the very next step calls.
  assert.deepEqual(run(timer, 101, 101, () => ({ talk: 'often' })), [101])
  // 조용히: never, however long.
  assert.deepEqual(run(timer, 102, 1000, () => ({ talk: 'quiet' })), [])
  assert.equal(timer.countingSince, null)
  // Back to 자주: counts from the switch, not from before.
  assert.deepEqual(run(timer, 1001, 1100, () => ({ talk: 'often' })), [1061])
})

test('camera off: no away judgement, the count goes on; camera on + away: stopped', () => {
  assert.deepEqual(run(new IdleTalkTimer(), 0, 70, () => ({ camera: false, away: true })), [60])
  assert.deepEqual(run(new IdleTalkTimer(), 0, 200, () => ({ camera: true, away: true })), [])
})

test('the call ending (or over) clears the timer; off screen (no PIP) does not count', () => {
  const timer = new IdleTalkTimer()
  run(timer, 0, 30, () => ({}))
  assert.equal(timer.countingSince, 0)
  assert.deepEqual(run(timer, 31, 400, () => ({ live: false })), [])
  assert.equal(timer.countingSince, null)
  // Hidden tab without PIP: stopped; back on screen: starts over.
  const hidden = new IdleTalkTimer()
  assert.deepEqual(run(hidden, 0, 200, (t) => ({ visible: t >= 100 })), [160])
  // clear() (the screen leaving) forgets the count.
  const left = new IdleTalkTimer()
  run(left, 0, 50, () => ({}))
  left.clear()
  assert.equal(left.countingSince, null)
})
