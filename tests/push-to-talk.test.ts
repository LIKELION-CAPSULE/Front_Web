import test from 'node:test'
import assert from 'node:assert/strict'
import { holdKeyApplies, PUSH_TO_TALK_TEXT, PushToTalk, recognitionErrorText, speechRecognitionFactory, type RecognitionLike } from '../src/features/mates/push-to-talk.ts'

/** A fake SpeechRecognition: records calls; the test drives its events. */
class FakeRecognition implements RecognitionLike {
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 0
  calls: string[] = []
  onstart: RecognitionLike['onstart'] = null
  onresult: RecognitionLike['onresult'] = null
  onerror: RecognitionLike['onerror'] = null
  onend: RecognitionLike['onend'] = null
  start() { this.calls.push('start') }
  stop() { this.calls.push('stop') }
  abort() { this.calls.push('abort') }
  results(...items: [string, boolean][]) {
    const results = items.map(([transcript, isFinal]) => Object.assign([{ transcript, confidence: 1 }], { isFinal })) as unknown as SpeechRecognitionResultList
    this.onresult?.({ resultIndex: 0, results })
  }
  error(code: string) { this.onerror?.({ error: code as SpeechRecognitionErrorCode }) }
  end() { this.onend?.(new Event('end')) }
}

function setup({ canListen = true, supported = true } = {}) {
  const made: FakeRecognition[] = []
  const sent: string[] = []
  const timers: (() => void)[] = []
  const talk = new PushToTalk(supported ? () => { const value = new FakeRecognition(); made.push(value); return value } : null, {
    send: (text) => { sent.push(text); return true },
    canListen: () => canListen,
    setTimer: (callback) => { timers.push(callback); return timers.length },
    clearTimer: () => {},
  })
  const flush = async () => { while (timers.length) timers.shift()!(); await Promise.resolve(); await Promise.resolve() }
  return { talk, made, sent, flush }
}

test('hold: listens in Korean with interim results while held; release stops and sends the sentence after a moment', async () => {
  const { talk, made, sent, flush } = setup()
  talk.start()
  const recognition = made[0]!
  assert.deepEqual([recognition.lang, recognition.continuous, recognition.interimResults, recognition.calls], ['ko-KR', true, true, ['start']])
  assert.equal(talk.getSnapshot().status, 'listening')
  recognition.results(['오늘 수학', false])
  assert.equal(talk.getSnapshot().text, '오늘 수학')
  recognition.results(['오늘 수학 같이 하자', true])
  talk.end()
  assert.deepEqual(recognition.calls, ['start', 'stop'])
  assert.equal(talk.getSnapshot().status, 'finishing')
  recognition.end()
  assert.equal(talk.getSnapshot().status, 'confirm', 'the sentence shows before it is sent')
  assert.equal(talk.getSnapshot().text, '오늘 수학 같이 하자')
  assert.deepEqual(sent, [])
  await flush()
  assert.deepEqual(sent, ['오늘 수학 같이 하자'])
  assert.equal(talk.getSnapshot().status, 'idle')
})

test('an interim result still pending at release is sent too', async () => {
  const { talk, made, sent, flush } = setup()
  talk.start()
  made[0]!.results(['안녕', false])
  talk.end()
  made[0]!.end()
  await flush()
  assert.deepEqual(sent, ['안녕'])
})

test('nothing heard: nothing is sent, 「잘 못 들었어요」 shows', async () => {
  const { talk, made, sent, flush } = setup()
  talk.start()
  made[0]!.error('no-speech')
  talk.end()
  made[0]!.end()
  assert.equal(talk.getSnapshot().notice, PUSH_TO_TALK_TEXT.notHeard)
  await flush()
  assert.deepEqual(sent, [])
})

test('errors read as Korean guidance and send nothing', async () => {
  for (const [code, part] of [['not-allowed', '마이크 권한'], ['audio-capture', '마이크를 찾지'], ['network', '인터넷 연결'], ['service-not-allowed', '음성 인식을 쓸 수 없어요']] as const) {
    const { talk, made, sent, flush } = setup()
    talk.start()
    made[0]!.results(['일부', false])
    made[0]!.error(code)
    made[0]!.end()
    assert.match(talk.getSnapshot().notice, new RegExp(part), code)
    assert.equal(talk.getSnapshot().noticeTone, 'error')
    await flush()
    assert.deepEqual(sent, [], code)
  }
  assert.equal(recognitionErrorText('aborted'), null)
})

test('unsupported browser: no recognition, the unsupported notice', () => {
  const { talk, made } = setup({ supported: false })
  assert.equal(talk.supported, false)
  talk.start()
  assert.equal(made.length, 0)
  assert.equal(talk.getSnapshot().notice, PUSH_TO_TALK_TEXT.unsupported)
  assert.equal(speechRecognitionFactory({}), null)
  assert.ok(speechRecognitionFactory({ webkitSpeechRecognition: FakeRecognition }))
})

test('the chat rule: while the mate is answering nothing listens', () => {
  const { talk, made } = setup({ canListen: false })
  talk.start()
  assert.equal(made.length, 0)
  assert.equal(talk.getSnapshot().notice, PUSH_TO_TALK_TEXT.busy)
})

test('cancel aborts and sends nothing; a late end is ignored', async () => {
  const { talk, made, sent, flush } = setup()
  talk.start()
  made[0]!.results(['보내지 마', true])
  talk.cancel()
  assert.deepEqual(made[0]!.calls, ['start', 'abort'])
  made[0]!.end()
  await flush()
  assert.deepEqual(sent, [])
  assert.equal(talk.getSnapshot().status, 'idle')
})

test('Space holds only off controls and fields, never with a modal or on the practice call', () => {
  const doc = (selectors: string[] = []) => ({ querySelector: (selector: string) => (selectors.includes(selector) ? {} : null) }) as unknown as Document
  const on = (closest: boolean, extra: Partial<KeyboardEvent> = {}) => ({ code: 'Space', key: ' ', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: { closest: () => (closest ? {} : null) }, ...extra })
  assert.ok(holdKeyApplies(on(false), doc()))
  assert.ok(!holdKeyApplies(on(true), doc()), 'a focused input / button keeps its Space')
  assert.ok(!holdKeyApplies({ ...on(false), target: { isContentEditable: true, closest: () => null } }, doc()))
  assert.ok(!holdKeyApplies(on(false), doc(['dialog:modal'])))
  assert.ok(!holdKeyApplies(on(false), doc(['[data-tour-practice]'])))
  assert.ok(!holdKeyApplies(on(false, { code: 'KeyA', key: 'a' }), doc()))
  assert.ok(!holdKeyApplies(on(false, { ctrlKey: true }), doc()))
})

import { SampleAudioPlayer } from '../src/features/mates/sample-audio.ts'

test('the voice sample plays at the settings volume and speed (also when changed while playing)', async () => {
  const audios: { volume?: number; playbackRate?: number; defaultPlaybackRate?: number }[] = []
  const player = new SampleAudioPlayer(() => {
    const audio = { play: async () => {}, pause() {}, load() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLAudioElement
    audios.push(audio)
    return audio
  })
  player.setPlayback({ volume: 0.35, playbackRate: 1.2 })
  await player.play('data:audio/wav;base64,AAAA')
  assert.deepEqual([audios[0]!.volume, audios[0]!.playbackRate, audios[0]!.defaultPlaybackRate], [0.35, 1.2, 1.2])
  player.setPlayback({ volume: 0.7, playbackRate: 0.85 })
  assert.deepEqual([audios[0]!.volume, audios[0]!.playbackRate], [0.7, 0.85])
})
