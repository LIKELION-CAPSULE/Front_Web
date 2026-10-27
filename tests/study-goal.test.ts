import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer, sessionElapsed } from '../src/features/demo/reducer.ts'
import { normalizeGoalMinutes, studyGoalSeconds } from '../src/features/session/study-goal.ts'
const now = Date.parse('2026-10-27T18:00:00+09:00')
const start = (targetMinutes: number) =>
  demoReducer(createDemoState(now), {
    type: 'START',
    now,
    roomId: 'room-2',
    characterIds: ['doyun'],
    tier: 'basic',
    camera: false,
    targetMinutes,
  })

test('goal minutes are bounded, rounded to five minutes and tolerate legacy sessions', () => {
  assert.equal(normalizeGoalMinutes(2), 5)
  assert.equal(normalizeGoalMinutes(999), 180)
  assert.equal(normalizeGoalMinutes(27), 25)
  assert.equal(normalizeGoalMinutes(NaN), 50)
  assert.equal(studyGoalSeconds({}), 3000)
})
test('a new target starts at zero and changes the actual timer transition', () => {
  let state = start(25)
  assert.equal(sessionElapsed(state.activeSession, now), 0)
  assert.equal(state.activeSession!.targetSeconds, 1500)
  state = demoReducer(state, { type: 'TICK', now: now + 1499000 })
  assert.equal(state.activeSession!.phase, 'study')
  state = demoReducer(state, { type: 'TICK', now: now + 1504000 })
  assert.equal(state.activeSession!.phase, 'break')
  assert.equal(state.activeSession!.studySeconds, 1500)
  assert.equal(sessionElapsed(state.activeSession, now + 1504000), 4)
})
test('pausing does not consume the goal and early finish stores actual and target separately', () => {
  let state = start(90)
  state = demoReducer(state, { type: 'PAUSE', now: now + 120000 })
  assert.equal(sessionElapsed(state.activeSession, now + 900000), 120)
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(studyGoalSeconds(restored.activeSession), 5400)
  state = demoReducer(restored, { type: 'FINISH', now: now + 900000 })
  assert.equal(state.records[0]!.studySeconds, 120)
  assert.equal(state.records[0]!.targetSeconds, 5400)
  assert.equal(state.records[0]!.completed, false)
})
test('finishing at the target before a timer tick still records goal completion once', () => {
  let state = start(5)
  state = demoReducer(state, { type: 'FINISH', now: now + 300000 })
  assert.equal(state.records[0]!.studySeconds, 300)
  assert.equal(state.records[0]!.targetSeconds, 300)
  assert.equal(state.records[0]!.completed, true)
  assert.equal(demoReducer(state, { type: 'FINISH', now: now + 300001 }), state)
})
