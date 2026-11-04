import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer, sessionElapsed, sessionStudySeconds } from '../src/features/demo/reducer.ts'
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
test('taking a break preserves the chosen goal and early finish stores actual and target separately', () => {
  let state = start(90)
  state = demoReducer(state, { type: 'TAKE_BREAK', now: now + 120000 })
  assert.equal(state.activeSession?.studySeconds, 120)
  assert.equal(sessionElapsed(state.activeSession, now + 120000), 0)
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

test('continuing a manual rest preserves the session, options and study total without charging again', () => {
  let state = demoReducer(createDemoState(now), {
    type: 'START', now, roomId: 'room-2', characterIds: ['doyun'], tier: 'standard', camera: true, targetMinutes: 5,
  })
  const original = state.activeSession!
  const credits = state.credits, ledger = state.ledger
  assert.equal(demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 1000 }), state)
  state = demoReducer(state, { type: 'TAKE_BREAK', now: now + 120500 })
  assert.equal(sessionStudySeconds(state.activeSession, now + 500000), 120.5)
  state = demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 500000 })
  assert.equal(state.activeSession!.id, original.id)
  assert.equal(state.activeSession!.tier, original.tier)
  assert.equal(state.activeSession!.targetSeconds, original.targetSeconds)
  assert.equal(state.activeSession!.camera, true)
  assert.equal(sessionStudySeconds(state.activeSession, now + 510000), 130.5)
  assert.equal(state.credits, credits)
  assert.equal(state.ledger, ledger)
  assert.equal(state.records.some(record => record.id === original.id), false)
  // Repeated rests keep the cumulative total, never the time spent resting.
  state = demoReducer(state, { type: 'TAKE_BREAK', now: now + 510000 })
  state = demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 600000 })
  state = demoReducer(state, { type: 'FINISH', now: now + 610000 })
  assert.equal(state.records[0]!.studySeconds, 140.5)
  assert.equal(state.records[0]!.completed, false)
})

test('continuing before the goal still takes the automatic rest at the cumulative target', () => {
  let state = demoReducer(start(5), { type: 'TAKE_BREAK', now: now + 120000 })
  state = demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 180000 })
  state = demoReducer(state, { type: 'TICK', now: now + 359000 })
  assert.equal(state.activeSession!.phase, 'study')
  state = demoReducer(state, { type: 'TICK', now: now + 364000 })
  assert.equal(state.activeSession!.phase, 'break')
  assert.equal(state.activeSession!.studySeconds, 300)
  assert.equal(sessionElapsed(state.activeSession, now + 364000), 4)
})

test('an explicit continuation after goal completion counts overtime and survives reload and further rests', () => {
  let state = demoReducer(start(5), { type: 'TICK', now: now + 300000 })
  assert.equal(state.activeSession!.phase, 'break')
  state = demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 1000000 })
  state = demoReducer(state, { type: 'TICK', now: now + 1060000 })
  assert.equal(state.activeSession!.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 1060000), 360)
  state = demoReducer(state, { type: 'TAKE_BREAK', now: now + 1060000 })
  state = JSON.parse(JSON.stringify(state))
  assert.equal(sessionStudySeconds(state.activeSession, now + 1120000), 360)
  state = demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 1120000 })
  state = demoReducer(state, { type: 'FINISH', now: now + 1150000 })
  assert.equal(state.records[0]!.studySeconds, 390)
  assert.equal(state.records[0]!.targetSeconds, 300)
  assert.equal(state.records[0]!.completed, true)
  assert.equal(demoReducer(state, { type: 'CONTINUE_STUDY', now: now + 1151000 }), state)
})

test('ten minutes of manual rest automatically resumes the same study total and options', () => {
  let state = demoReducer(start(5), { type: 'TAKE_BREAK', now: now + 120000 })
  const id = state.activeSession!.id, credits = state.credits, ledger = state.ledger
  state = demoReducer(state, { type: 'TICK', now: now + 719999 })
  assert.equal(state.activeSession!.phase, 'break')
  state = demoReducer(state, { type: 'TICK', now: now + 720000 })
  assert.equal(state.activeSession!.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 730000), 130)
  assert.equal(state.activeSession!.id, id)
  assert.equal(state.activeSession!.targetSeconds, 300)
  assert.equal(state.credits, credits)
  assert.equal(state.ledger, ledger)
})

test('a delayed tick crosses goal and rest boundaries once and records post-rest study', () => {
  let state = demoReducer(start(5), { type: 'TICK', now: now + 945000 })
  assert.equal(state.activeSession!.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 945000), 345)
  assert.equal(demoReducer(state, { type: 'TICK', now: now + 945000 }), state)
  state = demoReducer(state, { type: 'FINISH', now: now + 960000 })
  assert.equal(state.records[0]!.studySeconds, 360)
  assert.equal(state.records[0]!.completed, true)
})

test('a late tick can cross manual rest, the remaining goal and its automatic rest', () => {
  let state = demoReducer(start(5), { type: 'TAKE_BREAK', now: now + 120000 })
  state = demoReducer(state, { type: 'TICK', now: now + 1560000 })
  assert.equal(state.activeSession!.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 1560000), 360)
})

test('old saved completed rests restart study without counting frozen offline time', () => {
  let state = demoReducer(start(5), { type: 'TAKE_BREAK', now: now + 120000 })
  state = { ...state, activeSession: { ...state.activeSession!, elapsedMs: 600000, runningSince: null } }
  state = demoReducer(state, { type: 'TICK', now: now + 10000000 })
  assert.equal(state.activeSession!.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 10000000), 120)
})
