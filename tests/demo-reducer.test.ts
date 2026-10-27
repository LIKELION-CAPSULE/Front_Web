import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer, sessionElapsed, tierCost } from '../src/features/demo/reducer.ts'
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

test('pausing freezes elapsed time and resuming preserves its value', () => {
  let state = demoReducer(createDemoState(now), start())
  state = demoReducer(state, { type: 'PAUSE', now: now + 1000 })
  assert.equal(sessionElapsed(state.activeSession, now + 60000), 1)
  state = demoReducer(state, { type: 'PAUSE', now: now + 100000 })
  assert.equal(sessionElapsed(state.activeSession, now + 102000), 3)
})

test('study automatically enters break and preserves elapsed overflow', () => {
  let state = demoReducer(createDemoState(now), start())
  const transition = now + (3000 + 6) * 1000
  state = demoReducer(state, { type: 'TICK', now: transition })
  assert.equal(state.activeSession?.phase, 'break')
  assert.equal(state.activeSession?.studySeconds, 3000)
  assert.equal(sessionElapsed(state.activeSession, transition), 6)
  state = demoReducer(state, { type: 'TICK', now: transition + 700000 })
  assert.equal(state.activeSession?.runningSince, null)
  assert.equal(sessionElapsed(state.activeSession, transition + 800000), 600)
})

test('basic chat shares the daily limit across characters and resets at 05:00 Seoul', () => {
  let state = demoReducer(createDemoState(now), start('basic'))
  for (const id of ['chaerin', 'sua', 'dahee'])
    state = demoReducer(state, { type: 'MESSAGE', now, characterId: id, name: id, text: '화이팅' })
  assert.equal(state.chatUsage.used, 3)
  assert.equal(new Set(state.messages.map((message) => message.id)).size, 6)
  assert.equal(
    demoReducer(state, {
      type: 'MESSAGE',
      now,
      characterId: 'chaerin',
      name: '채린',
      text: '한 번 더',
    }),
    state,
  )
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

test('finishing records the session once and keeps focus plus away equal to total', () => {
  let state = demoReducer(createDemoState(now), start())
  state = demoReducer(state, { type: 'SKIP_TO_BREAK', now: now + 1 })
  const count = state.records.length
  state = demoReducer(state, { type: 'FINISH', now: now + 2 })
  assert.equal(state.records.length, count + 1)
  const record = state.records[0]!
  assert.equal(record.focusSeconds + record.awaySeconds, 3000)
  assert.equal(state.activeSession, null)
  assert.equal(demoReducer(state, { type: 'FINISH', now: now + 3 }), state)
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
