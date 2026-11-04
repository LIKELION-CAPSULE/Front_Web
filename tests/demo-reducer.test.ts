import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { BREAK_SECONDS, demoReducer, sessionElapsed, tierCost } from '../src/features/demo/reducer.ts'
import { businessDay } from '../src/shared/lib/format.ts'

const now = new Date('2026-10-26T20:00:00+09:00').getTime()
const start = (tier: 'basic' | 'standard' | 'premium' | 'special' = 'standard') => ({
  type: 'START' as const,
  now,
  roomId: 'dawn-library',
  characterIds: ['chaerin', 'sua', 'dahee'],
  tier,
  camera: true,
})

test('sample credit balance agrees with the ledger', () => {
  const state = createDemoState(now)
  assert.equal(state.credits, 1240)
  assert.equal(
    state.ledger.reduce((sum, entry) => sum + entry.change, 0),
    state.credits,
  )
})

test('a session and an upgrade debit only once and charge the difference', () => {
  let state = createDemoState(now)
  state = demoReducer(state, start())
  assert.equal(state.credits, 1040)
  assert.equal(demoReducer(state, start()), state)
  state = demoReducer(state, { type: 'UPGRADE', tier: 'premium', now: now + 1 })
  assert.equal(state.credits, 740)
  assert.equal(state.activeSession?.paidCredits, 500)
  assert.equal(demoReducer(state, { type: 'UPGRADE', tier: 'premium', now: now + 2 }), state)
  assert.equal(demoReducer(state, { type: 'UPGRADE', tier: 'basic', now: now + 3 }), state)
})

test('insufficient credit never creates a session or a negative balance', () => {
  const state = { ...createDemoState(now), credits: 100 }
  assert.equal(demoReducer(state, start('premium')), state)
  const basic = demoReducer(state, start('basic'))
  assert.equal(basic.credits, 100)
  assert.equal(basic.activeSession?.tier, 'basic')
})

test('taking a break starts ten minutes of rest and records only actual study time', () => {
  let state = demoReducer(createDemoState(now), start())
  const breakAt = now + 120500
  state = demoReducer(state, { type: 'FACE_FOCUS', sessionId: state.activeSession!.id,
    now: breakAt, totals: { observedMs: 120000, focusedMs: 90000, returns: 1 } })
  state = demoReducer(state, { type: 'TAKE_BREAK', now: breakAt })
  assert.equal(state.activeSession?.phase, 'break')
  assert.equal(state.activeSession?.studySeconds, 120.5)
  assert.equal(sessionElapsed(state.activeSession, breakAt), 0)
  assert.equal(sessionElapsed(state.activeSession, breakAt + 10000), 10)
  assert.equal(demoReducer(state, { type: 'TAKE_BREAK', now: breakAt + 10000 }), state)
  state = demoReducer(state, { type: 'TICK', now: breakAt + BREAK_SECONDS * 1000 })
  assert.equal(state.activeSession?.phase, 'study')
  assert.equal(sessionElapsed(state.activeSession, breakAt + BREAK_SECONDS * 1000), 120.5)
  assert.equal(demoReducer(state, { type: 'RESUME_SESSION', now: breakAt + 700000 }), state)
  state = demoReducer(state, { type: 'FINISH', now: breakAt + 700000 })
  assert.equal(state.records[0]?.studySeconds, 220.5)
  assert.equal(state.records[0]?.focusSeconds, 90)
  assert.equal(state.records[0]?.awaySeconds, 30)
  assert.equal(state.records[0]?.completed, false)
  assert.equal(demoReducer(state, { type: 'TAKE_BREAK', now: breakAt + 800000 }), state)
})

test('resuming a legacy stopped session cannot pause a running session', () => {
  let state = demoReducer(createDemoState(now), start())
  assert.equal(demoReducer(state, { type: 'RESUME_SESSION', now: now + 1000 }), state)
  state = { ...state, activeSession: { ...state.activeSession!, elapsedMs: 5000, runningSince: null } }
  state = demoReducer(state, { type: 'RESUME_SESSION', now: now + 100000 })
  assert.equal(sessionElapsed(state.activeSession, now + 102000), 7)
})

test('a late manual break caps study time at its goal without adding the delay to rest', () => {
  let state = demoReducer(createDemoState(now), start())
  state = demoReducer(state, { type: 'TAKE_BREAK', now: now + 3100000 })
  assert.equal(state.activeSession?.studySeconds, 3000)
  assert.equal(sessionElapsed(state.activeSession, now + 3100000), 0)
})

test('study automatically enters break and preserves elapsed overflow', () => {
  let state = demoReducer(createDemoState(now), start())
  const transition = now + (3000 + 6) * 1000
  state = demoReducer(state, { type: 'TICK', now: transition })
  assert.equal(state.activeSession?.phase, 'break')
  assert.equal(state.activeSession?.studySeconds, 3000)
  assert.equal(sessionElapsed(state.activeSession, transition), 6)
  state = demoReducer(state, { type: 'TICK', now: transition + 700000 })
  assert.equal(state.activeSession?.phase, 'study')
  assert.equal(sessionElapsed(state.activeSession, transition + 800000), 3206)
})

test('free chat remains available after three messages and still tracks daily usage', () => {
  let state = demoReducer(createDemoState(now), start('basic'))
  for (const id of ['chaerin', 'sua', 'dahee'])
    state = demoReducer(state, { type: 'MESSAGE', now, characterId: id, name: id, text: '화이팅' })
  assert.equal(state.chatUsage.used, 3)
  assert.equal(new Set(state.messages.map((message) => message.id)).size, 6)
  for (let i = 0; i < 10; i++) {
    state = demoReducer(state, { type: 'MESSAGE', now: now + i, characterId: 'chaerin', name: '채린', text: `한 번 더 ${i}` })
  }
  assert.equal(state.chatUsage.used, 13)
  assert.equal(state.messages.length, 26)
  const nextDay = new Date('2026-10-27T05:00:00+09:00').getTime()
  assert.notEqual(businessDay(nextDay - 1), businessDay(nextDay))
  state = demoReducer(state, {
    type: 'MESSAGE',
    now: nextDay,
    characterId: 'chaerin',
    name: '채린',
    text: '안녕',
  })
  assert.equal(state.chatUsage.used, 1)
})

test('finishing records the session once without inventing focus measurements', () => {
  let state = demoReducer(createDemoState(now), start())
  state = demoReducer(state, { type: 'TICK', now: now + 3000000 })
  const count = state.records.length
  state = demoReducer(state, { type: 'FINISH', now: now + 3010000 })
  assert.equal(state.records.length, count + 1)
  const record = state.records[0]!
  assert.equal(record.studySeconds, 3000)
  assert.equal(record.observedSeconds, 0)
  assert.equal(record.focusSeconds + record.awaySeconds, 0)
  assert.equal(record.returns, 0)
  assert.equal(state.activeSession, null)
  assert.equal(demoReducer(state, { type: 'FINISH', now: now + 3010001 }), state)
})

test('credit charging includes the selected bonus and records the running balance', () => {
  const initial = createDemoState(now)
  for (const [productId, received, amount] of [
    ['charge-9900', 10395, 9900],
    ['charge-19900', 20895, 19900],
  ] as const) {
    const next = demoReducer(initial, { type: 'PURCHASE', productId, method: '카드', now })
    assert.equal(next.credits, initial.credits + received)
    assert.equal(next.ledger[0]?.change, received)
    assert.equal(next.ledger[0]?.amount, amount)
    assert.equal(next.ledger[0]?.balance, next.credits)
    assert.equal(
      demoReducer(next, { type: 'PURCHASE', productId, method: '카드', now }),
      next,
    )
  }
})

test('a pass covers standard and one premium set per business day', () => {
  let state = demoReducer(createDemoState(now), {
    type: 'PURCHASE',
    productId: 'character-pass',
    method: '카드',
    now,
  })
  assert.equal(state.credits, 1240)
  assert.equal(tierCost(state, 'standard', now), 0)
  state = demoReducer(state, start('premium'))
  assert.equal(state.credits, 1240)
  assert.equal(tierCost(state, 'premium', now), 500)
  assert.equal(tierCost(state, 'premium', now + 86400000), 0)
})

test('gifts debit the ledger without changing study-based relationships', () => {
  const initial = createDemoState(now)
  const next = demoReducer(initial, {
    type: 'GIFT',
    productId: 'name',
    characterId: 'chaerin',
    characterName: '채린',
    now,
  })
  assert.equal(next.credits, 940)
  assert.equal(next.records, initial.records)
  assert.equal(next.gifts.length, initial.gifts.length + 1)
  const poor = { ...initial, credits: 50 }
  assert.equal(
    demoReducer(poor, {
      type: 'GIFT',
      productId: 'flowers',
      characterId: 'chaerin',
      characterName: '채린',
      now,
    }),
    poor,
  )
})

test('llm replies are recorded separately from the user message', () => {
  let state = demoReducer(createDemoState(now), start('basic'))
  state = demoReducer(state, { type: 'MESSAGE', now, characterId: 'chaerin', name: '채린', text: '졸려', reply: 'llm' })
  assert.deepEqual(state.messages.map((message) => message.sender), ['user'])
  assert.equal(state.chatUsage.used, 1)
  state = demoReducer(state, { type: 'CHARACTER_REPLY', sessionId: state.activeSession!.id, characterId: 'chaerin', text: ' 조금만 더 하자. ', now: now + 1 })
  assert.deepEqual(state.messages.map((message) => [message.sender, message.text]), [['user', '졸려'], ['character', '조금만 더 하자.']])
})
