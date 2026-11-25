/**
 * 「누르고 말하기」 on the connection screen: while the mic button (or Space, T-8) is held the browser's speech
 * recognition (Web Speech API) listens; on release the sentence goes out through the ordinary chat send (same API,
 * same credit rule as a typed message).
 *
 * Web Speech API (MDN, SpeechRecognition): constructor `SpeechRecognition` (Chrome/Edge/Safari also expose
 * `webkitSpeechRecognition`; Firefox has none); `lang`, `continuous`, `interimResults`, `maxAlternatives`; `start()`,
 * `stop()` (ends and delivers what was heard), `abort()` (ends without results); events `start`, `result`
 * (SpeechRecognitionEvent: `resultIndex`, `results` → SpeechRecognitionResult `isFinal` + alternatives' `transcript`),
 * `error` (SpeechRecognitionErrorEvent `error`: SpeechRecognitionErrorCode in lib.dom.d.ts) and `end`. TypeScript's
 * lib.dom has the events and results but not the recognition interface itself, so `RecognitionLike` is declared here.
 * In Chrome the audio is sent to the browser vendor's recognition service (the first-use notice says so).
 *
 * Pure apart from the injected recognition factory and timers (tests/push-to-talk.test.ts uses a fake).
 */

export type RecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((event: Event) => void) | null
  onresult: ((event: Pick<SpeechRecognitionEvent, 'resultIndex' | 'results'>) => void) | null
  onerror: ((event: Pick<SpeechRecognitionErrorEvent, 'error'>) => void) | null
  onend: ((event: Event) => void) | null
}
export type RecognitionFactory = () => RecognitionLike

/** The browser's recognition constructor, or null where there is none (Firefox): the mic is then unavailable. */
export function speechRecognitionFactory(target: unknown): RecognitionFactory | null {
  const scope = target as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike } | null
  const Recognition = scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition
  return Recognition ? () => new Recognition() : null
}

export const PUSH_TO_TALK_TEXT = {
  unsupported: '이 브라우저는 음성 입력을 지원하지 않아요. Chrome이나 Edge를 써 주세요',
  notHeard: '잘 못 들었어요. 다시 눌러 말해 주세요.',
  busy: '메이트가 답하는 중이에요. 끝나면 다시 눌러 주세요.',
  privacy: '음성은 브라우저의 음성 인식 서비스로 보내져 글자로 바뀌어요. CAPSULE은 녹음을 저장하지 않아요.',
} as const

/** What the user reads for a recognition error (null: say nothing, e.g. our own abort). */
export function recognitionErrorText(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null
    case 'no-speech':
      return PUSH_TO_TALK_TEXT.notHeard
    case 'not-allowed':
      return '마이크 권한이 꺼져 있어요. 주소창 왼쪽의 사이트 설정에서 마이크를 허용해 주세요.'
    case 'service-not-allowed':
      return '이 브라우저에서 음성 인식을 쓸 수 없어요. 브라우저 설정을 확인해 주세요.'
    case 'audio-capture':
      return '마이크를 찾지 못했어요. 마이크가 연결돼 있는지 확인해 주세요.'
    case 'network':
      return '음성 인식 서비스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'
    case 'language-not-supported':
      return '이 브라우저는 한국어 음성 인식을 지원하지 않아요.'
    default:
      return '음성을 알아듣지 못했어요. 다시 눌러 말해 주세요.'
  }
}

export type PushToTalkSnapshot = {
  /** idle → listening (held) → finishing (released, waiting for the last result) → confirm (the sentence shows) → idle. */
  status: 'idle' | 'listening' | 'finishing' | 'confirm'
  /** What has been heard so far (final + the latest interim). */
  text: string
  /** A short notice (not heard, an error, busy); cleared after a moment. */
  notice: string
  noticeTone: 'info' | 'error'
}

export type PushToTalkOptions = {
  /** Sends the sentence the ordinary chat way; returns whether it went out. */
  send: (text: string) => Promise<boolean> | boolean
  /** The chat rule: false while sending, while the mate is still answering or the connection ends. */
  canListen: () => boolean
  /** How long the recognized sentence shows before it is sent (ms). */
  confirmMs?: number
  /** How long a notice stays (ms). */
  noticeMs?: number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export class PushToTalk {
  private snapshot: PushToTalkSnapshot = { status: 'idle', text: '', notice: '', noticeTone: 'info' }
  private readonly listeners = new Set<() => void>()
  private recognition: RecognitionLike | null = null
  private finals = ''
  private interim = ''
  private failed = false
  private noticeTimer: unknown = null
  private confirmTimer: unknown = null
  private readonly factory: RecognitionFactory | null
  private readonly options: Required<Pick<PushToTalkOptions, 'confirmMs' | 'noticeMs' | 'setTimer' | 'clearTimer'>> & PushToTalkOptions
  constructor(factory: RecognitionFactory | null, options: PushToTalkOptions) {
    this.factory = factory
    this.options = {
      confirmMs: 500,
      noticeMs: 2600,
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      ...options,
    }
  }

  /** The latest chat callbacks (the screen re-renders; the recognizer stays). */
  setHandlers(handlers: Pick<PushToTalkOptions, 'send' | 'canListen'>) {
    this.options.send = handlers.send
    this.options.canListen = handlers.canListen
  }

  get supported() {
    return this.factory !== null
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private set(patch: Partial<PushToTalkSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  private notify(text: string, tone: 'info' | 'error' = 'info') {
    if (this.noticeTimer !== null) this.options.clearTimer(this.noticeTimer)
    this.set({ notice: text, noticeTone: tone })
    this.noticeTimer = this.options.setTimer(() => { this.noticeTimer = null; this.set({ notice: '' }) }, this.options.noticeMs)
  }

  /** The button / Space went down. */
  start() {
    if (this.snapshot.status !== 'idle') return
    if (!this.factory) { this.notify(PUSH_TO_TALK_TEXT.unsupported, 'error'); return }
    if (!this.options.canListen()) { this.notify(PUSH_TO_TALK_TEXT.busy); return }
    let recognition: RecognitionLike
    try {
      recognition = this.factory()
    } catch {
      this.notify(PUSH_TO_TALK_TEXT.unsupported, 'error')
      return
    }
    this.recognition = recognition
    this.finals = ''
    this.interim = ''
    this.failed = false
    recognition.lang = 'ko-KR'
    // Kept going for as long as the button is held (stopped on release).
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      if (this.recognition !== recognition) return
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]!
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) this.finals += transcript
        else interim += transcript
      }
      this.interim = interim
      this.set({ text: (this.finals + interim).trim() })
    }
    recognition.onerror = (event) => {
      if (this.recognition !== recognition) return
      const text = recognitionErrorText(event.error)
      if (event.error !== 'no-speech' && event.error !== 'aborted') this.failed = true
      if (text && event.error !== 'no-speech') this.notify(text, 'error')
    }
    recognition.onend = () => {
      if (this.recognition !== recognition) return
      this.recognition = null
      this.finish()
    }
    this.set({ status: 'listening', text: '', notice: '' })
    try {
      recognition.start()
    } catch {
      this.recognition = null
      this.set({ status: 'idle', text: '' })
      this.notify(recognitionErrorText('') ?? '', 'error')
    }
  }

  /** The button / Space came up: stop listening; the last result and `end` follow. */
  end() {
    if (this.snapshot.status !== 'listening') return
    this.set({ status: 'finishing' })
    try {
      this.recognition?.stop()
    } catch {
      this.recognition = null
      this.finish()
    }
  }

  /** Leaving the screen, the connection ending: drop what was heard, send nothing. */
  cancel() {
    const recognition = this.recognition
    this.recognition = null
    if (recognition) try { recognition.abort() } catch { /* Already ended. */ }
    if (this.confirmTimer !== null) this.options.clearTimer(this.confirmTimer)
    this.confirmTimer = null
    this.set({ status: 'idle', text: '' })
  }

  private finish() {
    const text = (this.finals + this.interim).trim()
    if (this.failed) { this.set({ status: 'idle', text: '' }); return }
    if (!text) { this.set({ status: 'idle', text: '' }); this.notify(PUSH_TO_TALK_TEXT.notHeard); return }
    // The sentence shows for a moment, then goes out the ordinary chat way.
    this.set({ status: 'confirm', text })
    this.confirmTimer = this.options.setTimer(() => {
      this.confirmTimer = null
      void Promise.resolve(this.options.send(text)).finally(() => this.set({ status: 'idle', text: '' }))
    }, this.options.confirmMs)
  }
}

/**
 * T-8: whether Space held down means 「누르고 말하기」 for this key event — only on the connection screen or its PIP
 * window, never while typing or on a control (a focused button, link, field or select keeps its own Space), never
 * with a modal open, and never on the service tour's practice call.
 */
export function holdKeyApplies(event: Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'> & { target: unknown }, doc: Pick<Document, 'querySelector'>): boolean {
  if (event.code !== 'Space' && event.key !== ' ') return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false
  if (doc.querySelector('dialog:modal') || doc.querySelector('[data-tour-practice]')) return false
  const target = event.target as { closest?: (selector: string) => unknown; isContentEditable?: boolean } | null
  if (target?.isContentEditable) return false
  if (target?.closest?.('input, textarea, select, button, a[href], summary, [role="button"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="slider"], [contenteditable=""], [contenteditable="true"]')) return false
  return true
}
