import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/shared/api/client.ts'
import {
  checkedMateDetail,
  checkMateReset,
  isMateResetConflict,
  MATE_RESET_CONFLICT_MESSAGE,
  mateResetErrorMessage,
  resetScopes,
  selectLeaveQuote,
} from '../src/features/mates/mate-contract.ts'
import type { MateDetailContent, MateResetReceipt } from '../src/features/mates/mate-contract.ts'
import { SampleAudioPlayer } from '../src/features/mates/sample-audio.ts'

test('mate details keep only supplied content and never manufacture a model or dialogue', () => {
  assert.deepEqual(checkedMateDetail({ characterId: 201 }, 201), { characterId: 201 })
  const input = { characterId: 201, introduction: '', role: '서버 역할', tags: [' A ', 'A', '', ' B '], model: { modelJsonUrl: '/model.json', scale: 1, offsetX: -1, offsetY: 2 }, voiceSampleUrl: 'https://assets.example/sample.wav', conversationRevision: 'r1', ignored: 'drop' }
  assert.deepEqual(checkedMateDetail(input, 201), { characterId: 201, introduction: '', role: input.role, tags: ['A', 'B'], model: input.model, voiceSampleUrl: input.voiceSampleUrl, conversationRevision: 'r1' })
})

test('mate details reject other characters, malformed models, and executable or authenticated asset URLs', () => {
  const invalid: unknown[] = [null, { characterId: 202 }, { characterId: 201, tags: [1] }, { characterId: 201, conversationRevision: ' ' },
    ...['javascript:alert(1)', 'file:///secret', 'data:text/html;base64,abc', 'https://user:pass@example.com/a'].map(modelJsonUrl => ({ characterId: 201, model: { modelJsonUrl } })),
    ...[0, -1, Infinity, NaN, '1'].map(scale => ({ characterId: 201, model: { modelJsonUrl: '/m.json', scale } })),
    { characterId: 201, model: { modelJsonUrl: '/m.json', offsetX: Infinity } }, { characterId: 201, voiceSampleUrl: 'data:text/html;base64,abc' }]
  for (const value of invalid) assert.throws(() => checkedMateDetail(value as MateDetailContent, 201), { status: 502 })
  assert.throws(() => checkedMateDetail({ characterId: -1 }, -1), { status: 502 })
  assert.equal(checkedMateDetail({ characterId: 201, voiceSampleUrl: 'data:audio/wav;base64,AAAA' }, 201).voiceSampleUrl, 'data:audio/wav;base64,AAAA')
})

test('a reset acknowledgement must match the character, previous revision and all four deletion scopes', () => {
  const receipt: MateResetReceipt = { characterId: 201, previousRevision: 'r1', revision: 'r2', cleared: [...resetScopes] }
  assert.doesNotThrow(() => checkMateReset(receipt, 201, 'r1'))
  const invalid: unknown[] = [null, { ...receipt, characterId: 202 }, { ...receipt, previousRevision: 'r0' }, { ...receipt, revision: 'r1' }, { ...receipt, revision: ' ' },
    ...resetScopes.map(missing => ({ ...receipt, cleared: resetScopes.filter(scope => scope !== missing) })), { ...receipt, cleared: [...resetScopes, 'records'] }]
  for (const value of invalid) assert.throws(() => checkMateReset(value as MateResetReceipt, 201, 'r1'), { status: 502 })
})

test('mate reset conflict errors map 409 and conflict codes to the reload guidance while keeping 500 messages', () => {
  const statusOnly409 = new ApiError('요청을 처리하지 못했어요.', 409)
  assert.equal(isMateResetConflict(statusOnly409), true)
  assert.equal(mateResetErrorMessage(statusOnly409), MATE_RESET_CONFLICT_MESSAGE)

  const coded409 = new ApiError('요청을 처리하지 못했어요.', 409, 'CONVERSATION_REVISION_CONFLICT')
  assert.equal(isMateResetConflict(coded409), true)
  assert.equal(mateResetErrorMessage(coded409), MATE_RESET_CONFLICT_MESSAGE)

  const server500 = new ApiError('요청을 처리하지 못했어요.', 500)
  assert.equal(isMateResetConflict(server500), false)
  assert.equal(mateResetErrorMessage(server500), '요청을 처리하지 못했어요.')
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
