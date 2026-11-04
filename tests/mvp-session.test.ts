import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer, sessionStudySeconds } from '../src/features/demo/reducer.ts'
import { migrateMvpSession } from '../src/features/mvp/session.ts'
import { isMvpCharacter, isMvpRoom } from '../src/features/mvp/policy.ts'
import { studyRooms } from '../src/features/rooms/data/rooms.ts'
import { normalizeGoalMinutes, studyGoalSeconds } from '../src/features/session/study-goal.ts'

const now = Date.parse('2026-11-04T18:00:00+09:00')

test('the MVP exposes exactly one room and Chaerin', () => {
  const rooms = studyRooms.filter(room => isMvpRoom(room.id))
  assert.deepEqual(rooms.map(room => room.id), ['dawn-library'])
  assert.equal(studyRooms.filter(room => !isMvpRoom(room.id)).length, 8)
  assert.deepEqual(rooms[0]!.characters.filter(character => isMvpCharacter(character.id)).map(character => character.id), ['chaerin'])
})

test('MVP starts for free with Chaerin and keeps studying past its three-minute goal', () => {
  const source = { ...createDemoState(now), credits: 0 }
  let state = demoReducer(source, { type: 'START_MVP', now })
  assert.equal(state.credits, 0)
  assert.equal(state.ledger, source.ledger)
  assert.equal(state.activeSession?.roomId, 'dawn-library')
  assert.deepEqual(state.activeSession?.characterIds, ['chaerin'])
  assert.equal(state.activeSession?.tier, 'basic')
  assert.equal(state.activeSession?.paidCredits, 0)
  assert.equal(state.activeSession?.targetSeconds, 180)
  assert.equal(normalizeGoalMinutes(3), 3)
  assert.equal(studyGoalSeconds(state.activeSession!), 180)
  assert.equal(demoReducer(state, { type: 'START_MVP', now: now + 1 }), state)
  state = demoReducer(state, { type: 'TICK', now: now + 179999 })
  assert.equal(state.activeSession?.phase, 'study')
  state = demoReducer(state, { type: 'TICK', now: now + 180000 })
  assert.equal(state.activeSession?.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 180000), 180)
  state = demoReducer(state, { type: 'TICK', now: now + 181000 })
  assert.equal(state.activeSession?.phase, 'study')
  assert.equal(sessionStudySeconds(state.activeSession, now + 181000), 181)
  state = demoReducer(state, { type: 'FINISH', now: now + 181000 })
  assert.equal(state.records[0]?.targetSeconds, 180)
  assert.equal(state.records[0]?.studySeconds, 181)
  assert.equal(state.records[0]?.completed, true)
})

test('old chat counters cannot exhaust MVP conversations', () => {
  let state = demoReducer(createDemoState(now), { type: 'START_MVP', now })
  state = { ...state, chatUsage: { ...state.chatUsage, used: 1000 } }
  for (let i = 0; i < 8; i++) {
    state = demoReducer(state, { type: 'MESSAGE', now: now + i, characterId: 'chaerin', name: '채린', text: '안녕' })
  }
  assert.equal(state.messages.filter(message => message.sender === 'user').length, 8)
  assert.equal(state.messages.filter(message => message.sender === 'character').length, 8)
})

test('saved live sessions adopt the MVP scope while preserving profile and completed history', () => {
  const source = demoReducer(createDemoState(now), {
    type: 'START', now, roomId: 'dawn-library', characterIds: ['chaerin', 'sua', 'dahee'], tier: 'standard', camera: true, targetMinutes: 50,
  })
  const next = migrateMvpSession(source)
  assert.deepEqual(next.activeSession?.characterIds, ['chaerin'])
  assert.equal(next.activeSession?.targetSeconds, 180)
  assert.equal(next.activeSession?.tier, 'basic')
  assert.equal(next.activeSession?.camera, true)
  assert.equal(next.activeSession?.startedAt, now)
  for (const field of ['profile', 'records', 'ledger', 'messages', 'credits'] as const) assert.equal(next[field], source[field])
  assert.equal(migrateMvpSession(next), next)
  const unsupported = { ...source, activeSession: { ...source.activeSession!, roomId: 'room-2' } }
  const blocked = migrateMvpSession(unsupported)
  assert.equal(blocked.activeSession, null)
  assert.equal(blocked.records, source.records)
})
