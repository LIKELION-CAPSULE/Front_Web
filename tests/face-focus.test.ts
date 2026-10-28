import assert from 'node:assert/strict'
import test from 'node:test'
import { FaceFocusTracker } from '../src/features/media/face-focus-tracker.ts'
import { focusMeasuredSeconds, focusPercent, normalizeFocusTotals, recordFocusPercent } from '../src/features/session/focus.ts'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { recordSummary, getRecordRange } from '../src/features/reports/record-period.ts'
import { companionTimeSeries } from '../src/features/reports/companion-time.ts'
import { capsuleFocusCopy } from '../src/features/reports/card-copy.ts'
import { measuredDuration } from '../src/shared/lib/format.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

const now = Date.parse('2026-10-28T12:00:00+09:00')
const begin = (camera = true) => demoReducer(createDemoState(now), {
  type: 'START', now, roomId: 'dawn-library', characterIds: ['chaerin'], tier: 'basic', camera,
})
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
test('session focus persists and actual measurements replace generated report scores', () => {
  let state = begin()
  const id = state.activeSession!.id
  state = demoReducer(state, { type: 'FACE_FOCUS', sessionId: id, now: now + 20000, totals: { observedMs: 10000, focusedMs: 7500, returns: 2 } })
  state = JSON.parse(JSON.stringify(state))
  state = demoReducer(state, { type: 'FINISH', now: now + 20000 })
  const result = state.records[0]!
  assert.equal(result.studySeconds, 20)
  assert.equal(result.observedSeconds, 10)
  assert.equal(result.focusSeconds, 7.5)
  assert.equal(result.awaySeconds, 2.5)
  assert.equal(result.returns, 2)
  assert.equal(recordFocusPercent(result), 75)
})
test('focus actions are idempotent, monotonic, bounded and tied to the active session', () => {
  let state = begin()
  const id = state.activeSession!.id
  const action = { type: 'FACE_FOCUS' as const, sessionId: id, now: now + 1000, totals: { observedMs: 800, focusedMs: 400, returns: 0 } }
  state = demoReducer(state, action)
  assert.equal(demoReducer(state, action), state)
  assert.equal(demoReducer(state, { ...action, sessionId: 'old' }), state)
  assert.equal(demoReducer(state, { ...action, now: NaN }), state)
  assert.equal(demoReducer(state, { ...action, totals: { observedMs: 600, focusedMs: 300, returns: 0 } }), state)
  const clamped = demoReducer(state, { ...action, totals: { observedMs: 5000, focusedMs: 5000, returns: 0 } })
  assert.equal(clamped.activeSession!.focus!.observedMs, 1000)
  assert.equal(clamped.activeSession!.focus!.focusedMs, 1000)
  const finished = demoReducer(state, { type: 'FINISH', now: now + 1000 })
  assert.equal(demoReducer(finished, action), finished)
})
test('camera-free and unmeasured sessions have an unknown focus rate rather than dummy scores', () => {
  const state = demoReducer(begin(false), { type: 'FINISH', now: now + 60000 })
  const result = state.records[0]!
  assert.equal(result.observedSeconds, 0)
  assert.equal(result.focusSeconds, 0)
  assert.equal(result.awaySeconds, 0)
  assert.equal(recordFocusPercent(result), null)
  assert.equal(recordSummary([result]).focusRate, null)
  assert.equal(capsuleFocusCopy(result), '집중 측정 대기 · 복귀 0회')
})
test('fractional-second focus remains proportional in a short finished session', () => {
  let state = begin()
  state = demoReducer(state, { type: 'FACE_FOCUS', sessionId: state.activeSession!.id, now: now + 1800, totals: { observedMs: 1600, focusedMs: 1200, returns: 0 } })
  state = demoReducer(state, { type: 'FINISH', now: now + 1800 })
  assert.equal(state.records[0]!.studySeconds, 1.8)
  assert.equal(recordFocusPercent(state.records[0]!), 75)
  assert.equal(measuredDuration(state.records[0]!.focusSeconds), '1.2초')
  assert.equal(capsuleFocusCopy(state.records[0]!), '집중 1.2초 · 복귀 0회')
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
  const { series } = companionTimeSeries(records, [{ id: 'chaerin', name: '채린' }], getRecordRange('week', now))
  assert.equal(series[0]!.focusRate, 62.5)
})
