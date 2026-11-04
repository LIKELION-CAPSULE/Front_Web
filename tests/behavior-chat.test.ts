import assert from 'node:assert/strict'
import test from 'node:test'
import { BehaviorMonitor, type BehaviorChange } from '../src/features/media/behavior-monitor.ts'
import type { BehaviorKind } from '../src/features/media/behavior-rules.ts'
import {
  behaviorPromptText, createBehaviorChatState, reactToBehavior, withRecentBehavior, type BehaviorMoment,
} from '../src/features/session/behavior-chat.ts'
import { CHAT_TEXT_LIMIT } from '../src/features/media/behavior-constants.ts'

const start = (at: number, ...started: BehaviorKind[]): BehaviorChange => ({ at, started, ended: [] })

test('a held state reaches the chat once, when it starts', () => {
  const monitor = new BehaviorMonitor()
  const changes: BehaviorChange[] = []
  monitor.onChange((change) => changes.push(change))
  const closed = { present: true as const, eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9, jawOpen: 0, yaw: 0 }
  for (let at = 0; at <= 10000; at += 100) monitor.observe({ face: closed }, at, at)
  let state = createBehaviorChatState()
  const prompts = changes.map((change) => {
    const result = reactToBehavior(state, change, false)
    state = result.state
    return result.prompt
  }).filter(Boolean)
  assert.deepEqual(changes.map((change) => change.started), [['drowsy']])
  assert.deepEqual(prompts.map((prompt) => prompt!.kind), ['drowsy'])
  assert.deepEqual(monitor.getSnapshot(), ['drowsy'])
  monitor.reset()
  assert.deepEqual(monitor.getSnapshot(), [])
})

test('cooldowns hold back repeats of a kind for 60 s and any reaction for 20 s', () => {
  let state = createBehaviorChatState()
  const react = (change: BehaviorChange) => {
    const result = reactToBehavior(state, change, false)
    state = result.state
    return result.prompt?.kind ?? null
  }
  assert.equal(react(start(0, 'phone')), 'phone')
  assert.equal(react(start(10_000, 'yawn')), null, 'global cooldown')
  assert.equal(react(start(30_000, 'phone')), null, 'phone cooldown')
  assert.equal(react(start(30_000, 'yawn')), 'yawn')
  assert.equal(react(start(60_000, 'phone')), 'phone')
})

test('requests made while a friend is replying are dropped without starting a cooldown', () => {
  let state = createBehaviorChatState()
  let result = reactToBehavior(state, start(0, 'headTurn'), true)
  assert.equal(result.prompt, null)
  state = result.state
  assert.equal(state.lastSentAt, null)
  assert.deepEqual(state.recent.map((moment) => moment.kind), ['headTurn'], 'still kept as context')
  result = reactToBehavior(state, start(1000, 'headTurn'), false)
  assert.equal(result.prompt?.kind, 'headTurn')
})

test('away is greeted on return, and the highest priority start wins', () => {
  let state = createBehaviorChatState()
  let result = reactToBehavior(state, start(0, 'away'), false)
  assert.equal(result.prompt, null, 'no message while the user is gone')
  state = result.state
  result = reactToBehavior(state, { at: 45_000, started: ['wave'], ended: [{ kind: 'away', since: 0 }] }, false)
  assert.deepEqual(result.prompt, { kind: 'away', at: 45_000, awayMs: 45_000 })
  assert.match(behaviorPromptText(result.prompt!), /45초 정도 자리를 비웠다가/)
  result = reactToBehavior(createBehaviorChatState(), start(0, 'wave', 'yawn', 'drowsy', 'headTurn', 'phone'), false)
  assert.equal(result.prompt?.kind, 'drowsy')
})

test('event prompts describe the situation and stay inside the server text limit', () => {
  for (const kind of ['away', 'drowsy', 'yawn', 'headTurn', 'phone', 'wave'] as const) {
    const text = behaviorPromptText({ kind, at: 0, awayMs: 125_000 })
    assert.match(text, /상황:/)
    assert.match(text, /반응 방향:/)
    assert.ok(text.length <= CHAT_TEXT_LIMIT)
  }
})

test('recent detections ride along with ordinary messages within five minutes', () => {
  const now = 1_000_000
  const recent: BehaviorMoment[] = [
    { kind: 'phone', at: now - 6 * 60_000 },
    { kind: 'drowsy', at: now - 90_000 },
    { kind: 'away', at: now - 3_000, awayMs: 125_000 },
  ]
  const text = withRecentBehavior('나 왔어', recent, ['phone'], now)
  assert.doesNotMatch(text, /6분 전/)
  assert.match(text, /- 2분 전: 눈을 감고 졸았음/)
  assert.match(text, /- 방금: 2분 자리를 비웠다가 돌아옴/)
  assert.match(text, /- 지금도: 핸드폰을 봄/)
  assert.ok(text.endsWith('[사용자 메시지]\n나 왔어'))
  assert.equal(withRecentBehavior('안녕', [], [], now), '안녕')
  const long = '가'.repeat(CHAT_TEXT_LIMIT - 20)
  assert.equal(withRecentBehavior(long, recent, [], now), long, 'context is dropped before the user text is cut')
})
