import assert from 'node:assert/strict'
import test from 'node:test'
import { awayIntensity, escalateAway, eventQueued, REACTION_HOLD_MS, takeHeldReaction, type EventFlow } from '../src/features/backend/session-event-flow.ts'

const away = (): EventFlow => ({ revision: 3, away: { eventId: 41, at: 0, intensity: 1 } })

test('motion events neither cancel reactions nor reset the away escalation', () => {
  let flow = away()
  for (const type of ['DROWSY', 'YAWN', 'WAVE', 'HEAD_TURN']) flow = eventQueued(flow, type)
  assert.deepEqual(flow, away())
  let step = escalateAway(flow, 60_000)
  assert.equal(step.intensity, 2)
  flow = eventQueued(step.flow, 'YAWN')
  step = escalateAway(flow, 300_000)
  assert.equal(step.intensity, 3)
  assert.equal(escalateAway(step.flow, 400_000).intensity, null, 'each level is requested once')
})

test('state events supersede earlier reactions, and only AWAY keeps the absence', () => {
  assert.deepEqual(eventQueued(away(), 'AWAY'), { revision: 4, away: away().away })
  for (const type of ['RETURN', 'BREAK', 'FOCUS']) assert.deepEqual(eventQueued(away(), type), { revision: 4, away: null })
  assert.deepEqual(escalateAway(eventQueued(away(), 'RETURN'), 600_000).intensity, null)
})

test('away intensity follows API 19: notice, one minute, five minutes', () => {
  assert.deepEqual([0, 59_999, 60_000, 299_999, 300_000].map(awayIntensity), [1, 1, 2, 2, 3])
})

test('held reactions leave oldest first, one at a time', () => {
  const held = [{ value: 'yawn', heldAt: 0 }, { value: 'wave', heldAt: 100 }]
  const first = takeHeldReaction(held, 1_000, () => true)
  assert.equal(first.next, 'yawn')
  assert.deepEqual(first.rest, [{ value: 'wave', heldAt: 100 }])
  assert.equal(takeHeldReaction(first.rest, 1_000, () => true).next, 'wave')
})

test('stale and expired held reactions are dropped', () => {
  const held = [{ value: 'old', heldAt: 0 }, { value: 'stale', heldAt: 20_000 }, { value: 'fresh', heldAt: 25_000 }]
  const taken = takeHeldReaction(held, REACTION_HOLD_MS + 1, value => value !== 'stale')
  assert.equal(taken.next, 'fresh')
  assert.deepEqual(taken.rest, [])
  assert.deepEqual(takeHeldReaction(held, 0, () => false), { next: null, rest: [] })
})
