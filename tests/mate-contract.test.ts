import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/shared/api/client.ts'
import {
  checkedMateDetail,
  isMateResetBlocked,
  MATE_RESET_CLEARS,
  MATE_RESET_IN_CONNECTION_MESSAGE,
  MATE_RESET_KEEPS,
  mateResetErrorMessage,
  selectLeaveQuote,
} from '../src/features/mates/mate-contract.ts'
import type { MateDetailContent } from '../src/features/mates/mate-contract.ts'
import { SampleAudioPlayer } from '../src/features/mates/sample-audio.ts'

test('mate details keep only supplied content and never manufacture a model or dialogue', () => {
  assert.deepEqual(checkedMateDetail({ characterId: 201 }, 201), { characterId: 201 })
  const input = { characterId: 201, introduction: '', role: '서버 역할', tags: [' A ', 'A', '', ' B '], model: { modelJsonUrl: '/model.json', scale: 1, offsetX: -1, offsetY: 2 }, voiceSampleUrl: 'https://assets.example/sample.wav', conversationRevision: 'r1', ignored: 'drop' }
  // 47 has no revision: an old `conversationRevision` field is dropped like any unknown one.
  assert.deepEqual(checkedMateDetail(input as MateDetailContent, 201), { characterId: 201, introduction: '', role: input.role, tags: ['A', 'B'], model: input.model, voiceSampleUrl: input.voiceSampleUrl })
})

test('mate details reject other characters, malformed models, and executable or authenticated asset URLs', () => {
  const invalid: unknown[] = [null, { characterId: 202 }, { characterId: 201, tags: [1] },
    ...['javascript:alert(1)', 'file:///secret', 'data:text/html;base64,abc', 'https://user:pass@example.com/a'].map(modelJsonUrl => ({ characterId: 201, model: { modelJsonUrl } })),
    ...[0, -1, Infinity, NaN, '1'].map(scale => ({ characterId: 201, model: { modelJsonUrl: '/m.json', scale } })),
    { characterId: 201, model: { modelJsonUrl: '/m.json', offsetX: Infinity } }, { characterId: 201, voiceSampleUrl: 'data:text/html;base64,abc' }]
  for (const value of invalid) assert.throws(() => checkedMateDetail(value as MateDetailContent, 201), { status: 502 })
  assert.throws(() => checkedMateDetail({ characterId: -1 }, -1), { status: 502 })
  assert.equal(checkedMateDetail({ characterId: 201, voiceSampleUrl: 'data:audio/wav;base64,AAAA' }, 201).voiceSampleUrl, 'data:audio/wav;base64,AAAA')
})

test('47 reset: 204 with no body or revision; its only conflict is 409 CONNECTION_IN_PROGRESS → 「연결을 먼저 마쳐 주세요」', () => {
  const inConnection = new ApiError('CONNECTION_IN_PROGRESS', 409, 'CONNECTION_IN_PROGRESS')
  assert.equal(isMateResetBlocked(inConnection), true)
  assert.equal(mateResetErrorMessage(inConnection), MATE_RESET_IN_CONNECTION_MESSAGE)
  assert.match(MATE_RESET_IN_CONNECTION_MESSAGE, /연결을 먼저 마쳐 주세요/)
  // A bare 409 is the same conflict (there is no other on 47).
  assert.equal(isMateResetBlocked(new ApiError('요청을 처리하지 못했어요.', 409)), true)

  const server500 = new ApiError('요청을 처리하지 못했어요.', 500)
  assert.equal(isMateResetBlocked(server500), false)
  assert.equal(mateResetErrorMessage(server500), '요청을 처리하지 못했어요.')
  assert.equal(mateResetErrorMessage('offline'), '대화를 초기화하지 못했어요. 다시 시도해 주세요.')
  assert.equal(isMateResetBlocked(new Error('x')), false)
})

test('47 reset dialog lists what is cleared and what stays, without overlap', () => {
  assert.deepEqual([...MATE_RESET_CLEARS], ['대화 기록', '대화 맥락(메이트가 기억한 내용)'])
  assert.deepEqual([...MATE_RESET_KEEPS], ['친밀도와 열린 표정', '연결 기록', '크레딧'])
  assert.equal(MATE_RESET_CLEARS.some(item => (MATE_RESET_KEEPS as readonly string[]).includes(item)), false)
})

test('selectLeaveQuote prefers detail farewellLine, falls back to mate farewellLine, and ignores blank values without taking chat history', () => {
  assert.equal(selectLeaveQuote.length, 2)
  assert.equal(
    selectLeaveQuote({ farewellLine: '상세 전용 끊기 멘트' }, { farewellLine: '기본 끊기 멘트' }),
    '상세 전용 끊기 멘트',
  )
  assert.equal(
    selectLeaveQuote(undefined, { farewellLine: '기본 끊기 멘트' }),
    '기본 끊기 멘트',
  )
  assert.equal(
    selectLeaveQuote({ farewellLine: '   ' }, { farewellLine: '기본 끊기 멘트' }),
    '기본 끊기 멘트',
  )
  assert.equal(selectLeaveQuote(undefined, undefined), '')
  assert.equal(selectLeaveQuote({ farewellLine: '   ' }, { farewellLine: ' \t\n ' }), '')
})

function audioFixture() {
  const events = new Map<string, Set<EventListenerOrEventListenerObject>>()
  let resolve!: () => void, reject!: (error: Error) => void, paused = 0, released = 0, loads = 0
  const play = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  const audio = { play: () => play, pause: () => { paused++ }, load: () => { loads++ }, removeAttribute: (name: string) => { assert.equal(name, 'src'); released++ },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => { if (!events.has(type)) events.set(type, new Set()); events.get(type)!.add(listener) },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => { events.get(type)?.delete(listener) } }
  return { audio, resolve, reject, paused: () => paused, released: () => released, loads: () => loads,
    listeners: () => [...events.values()].reduce((sum, value) => sum + value.size, 0),
    emit: (type: string) => { for (const listener of events.get(type) ?? []) { if (typeof listener === 'function') listener(new Event(type)); else listener.handleEvent(new Event(type)) } } }
}

test('samples only create audio after play, and completion releases the source and listeners', async () => {
  const fixture = audioFixture(), urls: string[] = [], statuses: string[] = []
  const player = new SampleAudioPlayer(url => { urls.push(url); return fixture.audio })
  const unsubscribe = player.subscribe(() => statuses.push(player.getSnapshot()))
  assert.deepEqual(urls, [])
  const pending = player.play('/sample.wav')
  assert.equal(player.getSnapshot(), 'loading')
  fixture.resolve(); await pending
  assert.equal(player.getSnapshot(), 'playing')
  fixture.emit('ended')
  assert.equal(player.getSnapshot(), 'idle')
  assert.equal(fixture.listeners(), 0); assert.equal(fixture.released(), 1); assert.equal(fixture.loads(), 1)
  assert.deepEqual(statuses, ['loading', 'playing', 'idle'])
  unsubscribe()
})

test('stopping a pending play cannot restart audio when its promise later resolves', async () => {
  const fixture = audioFixture(), player = new SampleAudioPlayer(() => fixture.audio)
  const pending = player.play('/sample.wav')
  player.stop()
  assert.equal(player.getSnapshot(), 'idle'); assert.equal(fixture.listeners(), 0)
  fixture.resolve(); await pending
  assert.equal(player.getSnapshot(), 'idle'); assert.ok(fixture.paused() >= 2)
})

test('replaced or stopped play failures cannot overwrite the current sample state', async () => {
  const old = audioFixture(), current = audioFixture()
  const player = new SampleAudioPlayer(url => url === '/old' ? old.audio : current.audio)
  const first = player.play('/old'), second = player.play('/current')
  current.resolve(); await second
  old.reject(new Error('cancelled')); await first
  assert.equal(player.getSnapshot(), 'playing'); assert.equal(old.listeners(), 0)
  assert.equal(current.released(), 0)
  player.stop(); assert.equal(current.released(), 1)
})

test('sample playback or decode failures can be retried and cannot leak sources', async () => {
  const first = audioFixture(), second = audioFixture()
  let calls = 0
  const player = new SampleAudioPlayer(() => ++calls === 1 ? first.audio : second.audio)
  const pending = player.play('/sample')
  first.reject(new Error('unavailable')); await pending
  assert.equal(player.getSnapshot(), 'error'); assert.equal(first.listeners(), 0); assert.equal(first.released(), 1)
  const retried = player.play('/sample')
  second.resolve(); await retried
  second.emit('error')
  assert.equal(player.getSnapshot(), 'error'); assert.equal(second.listeners(), 0); assert.equal(second.released(), 1)
})
