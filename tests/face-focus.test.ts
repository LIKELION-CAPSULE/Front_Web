import assert from 'node:assert/strict'
import test from 'node:test'
import { FaceFocusTracker } from '../src/features/media/face-focus-tracker.ts'
import { focusDetectedSeconds, focusMeasuredSeconds, focusPercent, normalizeFocusTotals, recordFocusPercent } from '../src/features/session/focus.ts'
import { recordSummary } from '../src/features/reports/record-period.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'
import { report as serverReport } from '../src/features/backend/adapters.ts'

const now = Date.parse('2026-10-28T12:00:00+09:00')
const record = (overrides: Partial<StudyRecord>): StudyRecord => ({
  id: 'focus-test', roomId: 'dawn-library', characterIds: ['chaerin'], tier: 'basic',
  startedAt: now, endedAt: now + 60000, studySeconds: 60, focusSeconds: 30, awaySeconds: 30,
  returns: 0, completed: false, automatic: false, ...overrides,
})

test('face presence is integrated by elapsed time rather than frame count', () => {
  for (const cadence of [50, 200, 1000]) {
    const tracker = new FaceFocusTracker('study', 60000)
    for (let at = 0; at <= 10000; at += cadence) tracker.observe(at, at, true)
    assert.deepEqual(tracker.getTotals(), { observedMs: 10000, focusedMs: 10000, returns: 0 })
  }
})
test('valid missing-face time lowers focus and a measured return is counted once', () => {
  const tracker = new FaceFocusTracker('study', 60000)
  tracker.observe(0, 0, true)
  tracker.observe(1000, 1000, false)
  tracker.observe(2000, 2000, false)
  tracker.observe(3000, 3000, true)
  assert.deepEqual(tracker.getTotals(), { observedMs: 3000, focusedMs: 1000, returns: 1 })
  assert.equal(focusPercent(1000, 3000), 33.3)
  tracker.observe(4000, 4000, true)
  assert.equal(tracker.getTotals().returns, 1)
})
test('long gaps, duplicate frames and out-of-order responses do not create missing time', () => {
  const tracker = new FaceFocusTracker('study', 60000)
  tracker.observe(0, 0, false)
  tracker.observe(5000, 5000, true)
  assert.deepEqual(tracker.getTotals(), { observedMs: 0, focusedMs: 0, returns: 0 })
  tracker.observe(5200, 5200, true)
  tracker.observe(5200, 5200, false)
  tracker.observe(5100, 5100, false)
  assert.deepEqual(tracker.getTotals(), { observedMs: 200, focusedMs: 200, returns: 0 })
})
test('interruption excludes paused, hidden, disconnected and unobserved intervals', () => {
  const tracker = new FaceFocusTracker('study', 600000)
  tracker.observe(0, 0, false)
  tracker.observe(200, 200, false)
  tracker.interrupt()
  tracker.observe(100000, 100000, true)
  tracker.observe(100200, 100200, true)
  assert.deepEqual(tracker.getTotals(), { observedMs: 400, focusedMs: 200, returns: 0 })
})
test('finish flushes only a fresh final interval and never passes the goal', () => {
  const tracker = new FaceFocusTracker('study', 500)
  tracker.observe(0, 0, true)
  tracker.observe(200, 200, false)
  tracker.close(600, 600)
  assert.deepEqual(tracker.getTotals(), { observedMs: 500, focusedMs: 200, returns: 0 })
  tracker.close(700, 700)
  assert.equal(tracker.getTotals().observedMs, 500)
  const delayed = new FaceFocusTracker('delayed', 60000)
  delayed.observe(0, 0, false)
  delayed.close(15000, 15000)
  assert.equal(delayed.getTotals().observedMs, 0)
})
test('reloading preserves cumulative totals without bridging the offline gap', () => {
  const initial = { observedMs: 3000, focusedMs: 2000, returns: 1 }
  const restored = new FaceFocusTracker('study', 60000, JSON.parse(JSON.stringify(initial)))
  restored.observe(10000, 30000, false)
  assert.deepEqual(restored.getTotals(), initial)
  restored.observe(10200, 30200, false)
  assert.deepEqual(restored.getTotals(), { observedMs: 3200, focusedMs: 2000, returns: 1 })
})
test('synthetic timer jumps and invalid samples do not fabricate measurements', () => {
  const tracker = new FaceFocusTracker('study', 300000)
  tracker.observe(0, 0, false)
  tracker.observe(200, 200000, false)
  tracker.observe(NaN, 200100, false)
  tracker.observe(300, Infinity, true)
  assert.equal(tracker.getTotals().observedMs, 0)
  assert.equal(focusPercent(0, 0), null)
  assert.deepEqual(normalizeFocusTotals({ observedMs: 100, focusedMs: 300, returns: -2 }), { observedMs: 100, focusedMs: 100, returns: 0 })
})
test('history and companion summaries weight valid measurement time and preserve legacy samples', () => {
  const legacy = record({ id: 'legacy' })
  const measured = record({ id: 'measured', studySeconds: 120, observedSeconds: 60, focusSeconds: 45, awaySeconds: 15 })
  const unknown = record({ id: 'unknown', studySeconds: 300, observedSeconds: 0, focusSeconds: 0, awaySeconds: 0 })
  assert.equal(focusMeasuredSeconds(legacy), 60)
  assert.equal(recordFocusPercent(legacy), 50)
  const records = [legacy, measured, unknown]
  assert.equal(recordSummary(records).seconds, 480)
  assert.equal(recordSummary(records).focusRate, 62.5)
})

test('a server presence settlement never substitutes for missing camera measurement', () => {
  const result = serverReport({ connectionId: 101, mate: { id: 201 }, startedAt: new Date(now).toISOString(), endedAt: new Date(now + 60000).toISOString(), connectedSeconds: 60, presentSeconds: 54, awaySeconds: 6, returnCount: 2 })
  assert.equal(result.focusSeconds, 54)
  assert.equal(focusMeasuredSeconds(result), 0)
  assert.equal(focusDetectedSeconds(result), 0)
  assert.equal(recordFocusPercent(result), null)
  assert.equal(recordSummary([result]).focusRate, null)
})

test('live camera totals remain the report and history basis even when server presence differs', () => {
  const result = serverReport({ connectionId: 101, mate: { id: 201 }, startedAt: new Date(now).toISOString(), endedAt: new Date(now + 60000).toISOString(), connectedSeconds: 60, presentSeconds: 54, awaySeconds: 6, returnCount: 2 })
  result.cameraFocus = { observedMs: 40000, focusedMs: 30000, returns: 1 }
  assert.equal(recordFocusPercent(result), 75)
  assert.equal(focusMeasuredSeconds(result), 40)
  assert.equal(focusDetectedSeconds(result), 30)
  const unmeasured = { ...result, id: 'unmeasured', cameraFocus: undefined }
  assert.equal(recordSummary([result, unmeasured]).focusRate, 75)
  const restored = JSON.parse(JSON.stringify(result)) as StudyRecord
  assert.equal(recordFocusPercent(restored), 75)
  // Backend whole-second settlement must not change the camera measurement ratio.
  assert.equal(recordFocusPercent({ ...restored, studySeconds: 39 }), 75)
})
