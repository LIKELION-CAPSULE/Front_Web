import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { LocalBetaStore, LOCAL_CHARACTER_ID } from '../src/features/local-demo/store.ts'
import { ApiClient } from '../src/shared/api/client.ts'
import { streamMessage } from '../src/features/backend/message-stream.ts'
import type { MessageRequest, MessageStreamAudio } from '../src/shared/api/types.ts'
import { decodeVoiceData, startsMp3File, voiceRequested, voiceStopsForListening, voiceStopsWhenHidden, VoiceChunkQueue } from '../src/features/mates/voice-reply.ts'
import { VoicePlayer, type VoiceBuffer, type VoiceContext, type VoiceSource } from '../src/features/mates/voice-player.ts'
import { LOCAL_VOICE_TONE_MP3, localVoicePieces } from '../src/features/local-demo/voice-tone.ts'
import { ConnectionSettingsStore, DEFAULT_CONNECTION_SETTINGS, mateVoiceOn, mateVoicePatch, parseConnectionSettings } from '../src/features/mates/connection-preferences.ts'
import { fromServerSettings, toServerSettings } from '../src/features/mates/connection-settings-sync.ts'

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (pieces: Uint8Array[]) => pieces.map(piece => [...piece].join(',')).join(' | ')

test('pieces play in seq order: early ones wait for the missing one, repeats and old ones are ignored', () => {
  const queue = new VoiceChunkQueue()
  assert.equal(text(queue.push(0, bytes(0))), '0')
  assert.equal(text(queue.push(2, bytes(2))), '', 'seq 2 waits for 1')
  assert.equal(queue.waiting, 1)
  assert.equal(text(queue.push(2, bytes(9))), '', 'a repeated piece is ignored')
  assert.equal(text(queue.push(1, bytes(1))), '1 | 2', 'the missing one releases what waited, in order')
  assert.equal(text(queue.push(0, bytes(0))), '', 'an old piece is ignored')
  assert.equal(text(queue.push(3, null)), '', 'undecodable data is not a piece')
  assert.equal(text(queue.push(-1, bytes(1))), '')
  assert.equal(text(queue.push(1.5, bytes(1))), '')
  assert.equal(text(queue.push('3', bytes(1))), '')
  assert.deepEqual(queue.end({ chunks: 3, complete: true }), { complete: true, delivered: 3 })
  assert.equal(text(queue.push(3, bytes(3))), '', 'nothing after audio_end')
})

test('a first piece numbered 1 sets the base at 1', () => {
  const queue = new VoiceChunkQueue()
  assert.equal(text(queue.push(1, bytes(1))), '1')
  assert.equal(text(queue.push(2, bytes(2))), '2')
  assert.deepEqual(queue.end({ chunks: 2, complete: true }), { complete: true, delivered: 2 })
})

test('a missing piece: what came before it plays, the rest is let go at the end, quietly', () => {
  const gap = new VoiceChunkQueue()
  gap.push(0, bytes(0)); gap.push(2, bytes(2)); gap.push(3, bytes(3))
  assert.deepEqual(gap.end({ chunks: 4, complete: true }), { complete: false, delivered: 1 })
  assert.equal(gap.waiting, 0)
  // The server says it is incomplete, or fewer pieces came than it counted, or the stream closed without audio_end.
  const told = new VoiceChunkQueue(); told.push(0, bytes(0))
  assert.equal(told.end({ chunks: 1, complete: false }).complete, false)
  const short = new VoiceChunkQueue(); short.push(0, bytes(0))
  assert.equal(short.end({ chunks: 3 }).complete, false)
  const cut = new VoiceChunkQueue(); cut.push(0, bytes(0))
  assert.deepEqual(cut.end(null), { complete: false, delivered: 1 })
  assert.equal(cut.closed, true)
})

test('base64 data and mp3 file starts', () => {
  assert.deepEqual([...decodeVoiceData('AAEC')!], [0, 1, 2])
  for (const value of ['', '%%%', null, 3]) assert.equal(decodeVoiceData(value), null)
  assert.equal(startsMp3File(bytes(0x49, 0x44, 0x33, 4, 0)), true, 'ID3 tag')
  const pieces = localVoicePieces(3).map(piece => decodeVoiceData(piece)!)
  assert.equal(pieces.length, 3)
  assert.equal(startsMp3File(pieces[0]!), true, 'a first frame with an Info header')
  assert.equal(startsMp3File(pieces[1]!), false, 'a cut of the same stream continues it')
  assert.equal(startsMp3File(pieces[2]!), false)
  assert.equal(pieces.reduce((sum, piece) => sum + piece.length, 0), decodeVoiceData(LOCAL_VOICE_TONE_MP3)!.length)
})

test('tts is asked for with 「메이트 음성」 on, in either mode; never from the practice call or a browser that cannot play it', () => {
  for (const mode of ['basic', 'advanced'] as const) {
    assert.equal(voiceRequested({ voiceEnabled: true, practice: false, playable: true, mode }), true)
    assert.equal(voiceRequested({ voiceEnabled: false, practice: false, playable: true, mode }), false)
    assert.equal(voiceRequested({ voiceEnabled: true, practice: true, playable: true, mode }), false)
    assert.equal(voiceRequested({ voiceEnabled: true, practice: false, playable: false, mode }), false)
  }
})

test('메이트 음성 is off until the user turns it on: the server default (voiceEnabled true) alone asks for nothing', () => {
  assert.equal(mateVoiceOn(DEFAULT_CONNECTION_SETTINGS), false, 'default: off')
  // A server copy saying true (its default, or chosen on another device) does not turn it on in this browser.
  const fromServer = { ...DEFAULT_CONNECTION_SETTINGS, ...fromServerSettings({ voiceEnabled: true }).settings }
  assert.equal(mateVoiceOn(fromServer), false)
  assert.equal(voiceRequested({ voiceEnabled: mateVoiceOn(fromServer), practice: false, playable: true }), false)
  // Turning it on (settings switch or the dock's button): the mark and the server value together; only voiceEnabled is saved.
  const on = parseConnectionSettings({ ...fromServer, ...mateVoicePatch(true) })
  assert.equal(mateVoiceOn(on), true)
  assert.deepEqual(toServerSettings(mateVoicePatch(true)), { voiceEnabled: true })
  assert.deepEqual(toServerSettings({ voiceOptIn: true }), {}, 'the mark alone never goes to the server')
  // Off on another device (server false): off here too; on again there: on here (the mark stays).
  assert.equal(mateVoiceOn({ ...on, ...fromServerSettings({ voiceEnabled: false }).settings }), false)
  assert.equal(mateVoiceOn({ ...on, ...fromServerSettings({ voiceEnabled: true }).settings }), true)
  const off = parseConnectionSettings({ ...on, ...mateVoicePatch(false) })
  assert.deepEqual([off.voice, off.voiceOptIn, mateVoiceOn(off)], [false, false, false])
  assert.deepEqual(toServerSettings(mateVoicePatch(false)), { voiceEnabled: false })
  // Kept per account in this browser.
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
  new ConnectionSettingsStore(storage, 7).update(mateVoicePatch(true))
  assert.equal(mateVoiceOn(new ConnectionSettingsStore(storage, 7).getSnapshot()), true)
  assert.equal(mateVoiceOn(new ConnectionSettingsStore(storage, 8).getSnapshot()), false)
})

test('stop conditions: talking, and a hidden tab unless PiP is open', () => {
  assert.equal(voiceStopsWhenHidden({ hidden: true, pipOpen: false }), true)
  assert.equal(voiceStopsWhenHidden({ hidden: true, pipOpen: true }), false)
  assert.equal(voiceStopsWhenHidden({ hidden: false, pipOpen: false }), false)
  for (const status of ['listening', 'finishing']) assert.equal(voiceStopsForListening(status), true)
  for (const status of ['idle', 'confirm', 'sending', 'unsent']) assert.equal(voiceStopsForListening(status), false)
})

/** Web Audio stand-in: a decoded buffer has 10 samples per byte at 1 kHz; sources record how they were started. */
class FakeContext {
  currentTime = 0
  state: string
  destination = {}
  gain = { value: 1 }
  started: { bytes: number; when: number; offset: number; duration: number; stopped: boolean }[] = []
  decoded: number[] = []
  failOn: (size: number) => boolean = () => false
  private listener: (() => void) | null = null
  constructor(state = 'running') { this.state = state }
  resume = async () => { this.state = 'running'; this.listener?.() }
  close = async () => { this.state = 'closed' }
  addEventListener = (_type: 'statechange', listener: () => void) => { this.listener = listener }
  removeEventListener = () => { this.listener = null }
  createGain = () => ({ gain: this.gain, connect() {}, disconnect() {} })
  createAnalyser = () => ({ fftSize: 0, connect() {}, disconnect() {}, getByteTimeDomainData(array: Uint8Array) { array.fill(200) } })
  createBufferSource = (): VoiceSource => {
    const record = { bytes: 0, when: 0, offset: 0, duration: 0, stopped: false }
    const source: VoiceSource = {
      buffer: null, onended: null, connect() {}, disconnect() {},
      start: (when = 0, offset = 0, duration = 0) => { Object.assign(record, { bytes: source.buffer!.length / 10, when, offset, duration }); this.started.push(record) },
      stop: () => { record.stopped = true },
    }
    return source
  }
  decodeAudioData = async (data: ArrayBuffer): Promise<VoiceBuffer> => {
    this.decoded.push(data.byteLength)
    if (this.failOn(data.byteLength)) throw new Error('cannot decode')
    return { length: data.byteLength * 10, sampleRate: 1000, duration: data.byteLength / 100 }
  }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const b64 = (size: number, first = 0x00) => Buffer.from([first, ...new Array(size - 1).fill(7)]).toString('base64')
const id3 = (size: number) => Buffer.from([0x49, 0x44, 0x33, ...new Array(size - 3).fill(7)]).toString('base64')
function player(state?: string) {
  const context = new FakeContext(state)
  let now = 0
  const voice = new VoicePlayer({ createContext: () => context as unknown as VoiceContext, now: () => now })
  return { voice, context, tick: (ms: number) => { now += ms } }
}

test('the pieces of one stream join without a gap: each decode covers it from the start, the held-back tail goes last', async () => {
  const { voice, context } = player()
  const turn = voice.begin()
  turn.push({ seq: 0, data: b64(40) })
  await settle()
  turn.push({ seq: 1, data: b64(40) })
  await settle()
  assert.deepEqual(context.decoded, [40, 80], 'the second decode covers both pieces')
  turn.end({ chunks: 2, complete: true })
  await settle()
  assert.deepEqual(context.decoded, [40, 80, 80], 'the final decode of the whole segment')
  const [first, second, last] = context.started
  // 400 samples at 1 kHz = 0.4 s, the last 80 ms held back until the segment is final.
  assert.ok(Math.abs(first!.offset - 0) < 1e-9 && Math.abs(first!.duration - 0.32) < 1e-9)
  assert.ok(Math.abs(second!.when - (first!.when + 0.32)) < 1e-9 && Math.abs(second!.offset - 0.32) < 1e-9)
  assert.ok(Math.abs(last!.when - (second!.when + second!.duration)) < 1e-9, 'every part starts where the one before ends')
  assert.ok(Math.abs(last!.offset + last!.duration - 0.8) < 1e-9, 'all of it plays, once')
  assert.equal(voice.getSnapshot(), 'playing')
})

test('a piece that starts a new file starts a new segment where the last one ends', async () => {
  const { voice, context } = player()
  const turn = voice.begin()
  turn.push({ seq: 0, data: id3(30) })
  turn.push({ seq: 1, data: id3(20) })
  turn.end({ chunks: 2, complete: true })
  await settle(); await settle()
  assert.deepEqual(context.decoded, [30, 20], 'each file decoded on its own')
  const [first, second] = context.started
  assert.ok(Math.abs(first!.duration - 0.3) < 1e-9, 'the first file is final as soon as the next one starts')
  assert.ok(Math.abs(second!.when - (first!.when + 0.3)) < 1e-9)
})

test('a missing piece: playback ends where the unbroken run ends', async () => {
  const { voice, context } = player()
  const turn = voice.begin()
  turn.push({ seq: 0, data: b64(30) })
  turn.push({ seq: 2, data: b64(30) })
  turn.end({ chunks: 3, complete: false })
  await settle(); await settle()
  const total = context.started.reduce((sum, value) => sum + value.duration, 0)
  assert.ok(Math.abs(total - 0.3) < 1e-9, 'only piece 0')
})

test('a cut that cannot be decoded yet waits; the voice still ends quietly', async () => {
  const { voice, context } = player()
  context.failOn = size => size < 50
  const turn = voice.begin()
  turn.push({ seq: 0, data: b64(30) })
  await settle()
  assert.equal(context.started.length, 0)
  turn.push({ seq: 1, data: b64(30) })
  turn.end(null)
  await settle(); await settle()
  assert.ok(Math.abs(context.started.reduce((sum, value) => sum + value.duration, 0) - 0.6) < 1e-9)
})

test('a new reply stops the voice before it, and late pieces of the old one are dropped', async () => {
  const { voice, context } = player()
  const old = voice.begin()
  old.push({ seq: 0, data: b64(40) })
  await settle()
  assert.equal(context.started.length, 1)
  const next = voice.begin()
  assert.equal(context.started[0]!.stopped, true)
  old.push({ seq: 1, data: b64(40) })
  old.end({ chunks: 2, complete: true })
  await settle()
  assert.equal(context.started.length, 1, 'nothing more from the old voice')
  next.push({ seq: 0, data: b64(10) })
  await settle()
  assert.equal(context.started.length, 2)
  voice.stop()
  assert.equal(context.started[1]!.stopped, true)
  assert.equal(voice.getSnapshot(), 'idle')
  assert.equal(voice.level(), null, 'no voice: the mouth is the model\'s own')
})

test('blocked by the autoplay rule until a gesture; a voice held too long is dropped then', async () => {
  const { voice, context, tick } = player('suspended')
  context.resume = async () => { /* not allowed without a gesture */ }
  voice.play(b64(20))
  await settle()
  assert.equal(voice.getSnapshot(), 'blocked')
  context.resume = async () => { context.state = 'running' }
  voice.unlock()
  await settle(); await settle()
  assert.equal(voice.getSnapshot(), 'playing')
  assert.ok(voice.level()! > 0, 'the mouth follows the voice')
  // Held for longer than 10 s: dropped when sound is allowed.
  context.state = 'suspended'
  context.resume = async () => {}
  voice.play(b64(20))
  await settle()
  tick(11_000)
  context.resume = async () => { context.state = 'running' }
  voice.unlock()
  await settle()
  assert.equal(voice.getSnapshot(), 'idle')
  assert.equal(context.started.at(-1)!.stopped, true)
})

test('the volume follows the setting', () => {
  const { voice, context } = player()
  voice.setVolume(0.4)
  voice.play(b64(10))
  assert.equal(context.gain.value, 0.4)
  voice.setVolume(2)
  assert.equal(context.gain.value, 1)
})

const body: MessageRequest = { requestId: 'r-1', characterId: 3, content: '안녕', inputType: 'TEXT', tts: true }
const done = { requestId: 'r-1', characterId: 3, content: '응, 안녕!', voice: true }
const event = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
/** An SSE body whose parts arrive one by one, each after `gate` lets it go. */
function gatedStream(parts: string[]) {
  const encoder = new TextEncoder()
  let release: () => void = () => {}
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= parts.length) { controller.close(); return }
      if (index > 0) await new Promise<void>(resolve => { release = resolve })
      controller.enqueue(encoder.encode(parts[index++]!))
    },
  })
  return { response: new Response(stream, { headers: { 'content-type': 'text/event-stream' } }), next: () => release() }
}

test('a voice turn resolves at done while the voice pieces after it keep coming, then closes', async () => {
  const gated = gatedStream([event('reply', { content: '응' }) + event('audio', { seq: 0, format: 'mp3', data: 'AA==' }) + event('done', done), event('audio', { seq: 1, format: 'mp3', data: 'AQ==' }), event('audio_end', { chunks: 2, complete: true })])
  const api = new ApiClient(async () => gated.response)
  const audio: MessageStreamAudio[] = []
  const ends: unknown[] = []
  let closed = 0
  const result = await streamMessage(api, 1, body, { onReply: () => {}, onAudio: piece => audio.push(piece), onAudioEnd: end => ends.push(end), onAudioClose: () => closed++ })
  assert.deepEqual(result, done)
  assert.deepEqual(audio.map(piece => piece.seq), [0])
  assert.equal(closed, 0, 'the voice is still streaming')
  gated.next(); await settle(); await settle()
  gated.next(); await settle(); await settle()
  assert.deepEqual(audio.map(piece => piece.seq), [0, 1])
  assert.deepEqual(ends, [{ chunks: 2, complete: true }])
  assert.equal(closed, 1)
})

test('a voice turn that came without voice (credits short) closes as its stream ends', async () => {
  const api = new ApiClient(async () => new Response(event('done', { ...done, voice: false }), { headers: { 'content-type': 'text/event-stream' } }))
  let closed = 0
  const result = await streamMessage(api, 1, body, { onReply: () => {}, onAudio: () => {}, onAudioClose: () => closed++ })
  assert.equal(result.voice, false)
  await settle()
  assert.equal(closed, 1)
})

test('local mock: tts with 「메이트 음성」 on streams the test tone in pieces and charges 20; off, no voice', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  try {
    const { createLocalTransport } = await server.ssrLoadModule('/src/features/local-demo/transport.ts') as typeof import('../src/features/local-demo/transport.ts')
    const store = new LocalBetaStore(null)
    const fetch = createLocalTransport(store, async () => new Response('asset'), 'http://local.test')
    const request = (path: string, body?: object, method = 'POST') => fetch(`http://local.test/api/backend${path}`, { method: body ? method : 'GET', ...(body ? { body: JSON.stringify(body) } : {}) })
    const { data } = await (await request('/connections', { mateId: LOCAL_CHARACTER_ID })).json()
    const path = `/connections/${data.connectionId}`
    const credits = () => store.data.wallet.attendance + store.data.wallet.invitation
    const before = credits()
    const stream = await (await request(`${path}/messages/stream`, { requestId: 'voice-1', characterId: LOCAL_CHARACTER_ID, content: '안녕', inputType: 'TEXT', mode: 'BASIC', tts: true })).text()
    const events = [...stream.matchAll(/event: (\w+)\ndata: (.*)\n/g)].map(match => [match[1], JSON.parse(match[2]!)] as const)
    const names = events.map(([name]) => name)
    assert.deepEqual(names, ['reply', 'audio', 'reply', 'audio', 'done', 'audio', 'audio_end'], 'pieces between the replies and after done')
    assert.deepEqual(events.filter(([name]) => name === 'audio').map(([, value]) => value.seq), [0, 1, 2])
    assert.equal(events.find(([name]) => name === 'done')![1].voice, true)
    assert.equal(events.find(([name]) => name === 'done')![1].charged, 20)
    assert.deepEqual(events.at(-1)![1], { chunks: 3, complete: true })
    assert.equal(before - credits(), 20)
    // 「메이트 음성」 off (30): tts asks, but no voice and no charge.
    await request('/me/settings', { voiceEnabled: false }, 'PATCH')
    const quiet = await (await request(`${path}/messages/stream`, { requestId: 'voice-2', characterId: LOCAL_CHARACTER_ID, content: '안녕', inputType: 'TEXT', mode: 'BASIC', tts: true })).text()
    assert.equal(quiet.includes('event: audio'), false)
    assert.equal(before - credits(), 20)
    // A reaction line with tts: the tone as audioBase64 for 20, once the setting is on again.
    await request('/me/settings', { voiceEnabled: true }, 'PATCH')
    const event = await (await request(`${path}/events`, { type: 'RETURN', occurredAt: new Date().toISOString() })).json()
    const line = await (await request(`${path}/events/${event.data.eventId}/reaction`, { requestId: 'line-1', tts: true })).json()
    assert.equal(line.data.characters[0].audioBase64, LOCAL_VOICE_TONE_MP3)
    assert.equal(line.data.charged, 20)
    assert.equal(before - credits(), 40)
    const second = await (await request(`${path}/events`, { type: 'RETURN', occurredAt: new Date().toISOString() })).json()
    const plain = await (await request(`${path}/events/${second.data.eventId}/reaction`, { requestId: 'line-2', tts: false })).json()
    assert.equal(plain.data.characters[0].audioBase64, null)
    assert.equal(plain.data.credits, null)
  } finally { await server.close() }
})
