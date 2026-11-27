import {
  useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject,
} from 'react'
import { cn } from '@/shared/lib/cn'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { Brand } from '@/shared/ui/Brand'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { PixelImage, PixelRoofStrip } from '@/shared/ui/pixel/PixelFrame'
import { TypingMessage } from '@/features/session/components/TypingMessage'
import { TypingIndicator } from '@/features/session/components/TypingIndicator'
import { TALK_OPTIONS, type TalkFrequency } from '@/features/mates/connection-preferences'
import { AFFINITY_STAGE_COUNT } from '@/features/mates/mate-features'
import { REPLY_ACTIONS_COPY } from '@/features/mates/components/ReplyActions'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import { CALL_STAGE_GRADIENT, mateCallBackground, matePortrait } from '@/features/mates/artwork'
import faceNeutral from '@/assets/characters/chaerin-v2/expressions/neutral.webp'
import {
  CALL_UI_MATE, CALL_UI_SCENES, CALL_UI_USER, CALL_UI_VARIANT_NAME, LONG_LINE, QUICK_REPLIES, REPLIES, SPOKEN_SAMPLE,
  UNREAD_LINE, callUiHistory, letterPace, messageTime, subtitlePages,
  type CallUiMessage, type CallUiScene, type CallUiVariant,
} from './script'
import './call-ui.css'

/**
 * Call-screen UI drafts (2026-11-27, review catalog only: `call-ui-c1|c2|c3`). A stand-alone copy of the call screen's
 * layout with a still mate (no Live2D, no server): grouped chat bubbles, the stage subtitle, one composer with
 * push-to-talk and quick replies, a grouped dock and a one-line info bar, each draft in its own arrangement:
 * - C1 「대사창」: a game dialogue box low on the stage, always shown; the chat panel is the calm archive.
 * - C2 「말풍선 무대」: a speech bubble by her head while the chat is closed; the chat floats over the stage.
 * - C3 「분할 정돈」: today's layout tidied; a lower-third caption, one line while the chat is open.
 * Nothing here is used by the product (ConnectionPage is untouched). URL: `?cu-scene=idle|speaking|waiting|unread`,
 * `cu-chat=open|closed`, `cu-bar=0` (hides the review bar for screenshots).
 */

type Line = { id: string; text: string }
type Notice = string | null

const MATE_ID = 'chaerin'
const DEMO_CREDITS = 1180
const DEMO_AFFINITY = { stage: 2, name: '아는 사이' }

/* ── Viewport width (for the subtitle's page size) ──────────────────────────────────────────────────────────── */

const subscribeResize = (notify: () => void) => {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}
const useViewportWidth = () => useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1440)

const chatWidth = (vw: number) => (vw <= 960 ? 300 : vw <= 1180 ? 330 : 360)

/** Letters per subtitle page: about the box's lines × letters per line (Korean ≈ one font size per letter). */
function subtitleCapacity(variant: CallUiVariant, vw: number, chatOpen: boolean) {
  const stage = vw - 24 - (chatOpen && variant !== 'c2' ? chatWidth(vw) + 12 : 0)
  if (variant === 'c1') return Math.floor((Math.min(760, stage - 48) - 64) / 18) * 2.4
  if (variant === 'c2') return Math.floor(300 / 16) * 2.6
  const width = Math.min(720, stage - 48) - 48
  return Math.floor(width / 16) * (chatOpen ? 1 : 2)
}

function readParams() {
  const params = new URLSearchParams(location.search)
  const scene = params.get('cu-scene')
  const chat = params.get('cu-chat')
  return {
    scene: (CALL_UI_SCENES.some(item => item.id === scene) ? scene : 'speaking') as CallUiScene,
    chat: chat === 'closed' ? false : chat === 'open' ? true : null,
    /** `cu-bar=0`: no review bar at all (screenshots). */
    bar: params.get('cu-bar') !== '0',
  }
}

/* ── Root ──────────────────────────────────────────────────────────────────────────────────────────────────── */

export function CallUiPreview({ variant }: { variant: CallUiVariant }) {
  const [initial] = useState(readParams)
  const reduced = useReducedMotion()
  const vw = useViewportWidth()
  const [scene, setScene] = useState<CallUiScene>(initial.scene)
  const [chatOpen, setChatOpen] = useState(initial.scene === 'unread' ? true : initial.chat ?? true)
  const [messages, setMessages] = useState<CallUiMessage[]>(() => callUiHistory(initial.scene))
  const [pending, setPending] = useState(initial.scene === 'waiting')
  const [line, setLine] = useState<Line | null>(null)
  const [subSpeaking, setSubSpeaking] = useState(false)
  const [chatTyping, setChatTyping] = useState(false)
  const [unread, setUnread] = useState(0)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [camera, setCamera] = useState(false)
  const [pipOn, setPipOn] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [talk, setTalk] = useState<TalkFrequency>('sometimes')
  const [notice, setNotice] = useState<Notice>(null)
  const [barOpen, setBarOpen] = useState(true)

  const timers = useRef<number[]>([])
  const replyIndex = useRef(0)
  const atBottom = useRef(true)
  const logRef = useRef<HTMLDivElement>(null)
  const seen = useRef(new Set<string>(messages.map(message => message.id)))

  const later = useCallback((ms: number, run: () => void) => { timers.current.push(window.setTimeout(run, ms)) }, [])
  const clearTimers = useCallback(() => { for (const id of timers.current) clearTimeout(id); timers.current = [] }, [])

  const mateSay = useCallback((text: string) => {
    const id = `m-${Date.now()}`
    setPending(false)
    setMessages(list => [...list, { id, sender: 'mate', text, at: Date.now(), live: true }])
    setLine({ id, text })
    if (!atBottom.current) setUnread(count => count + 1)
  }, [])

  /** The timed part of a scene (state is set by `resetTo`). */
  const kick = useCallback((next: CallUiScene) => {
    if (next === 'speaking') later(500, () => mateSay(LONG_LINE))
    if (next === 'unread') {
      later(80, () => {
        const log = logRef.current
        if (log) log.scrollTop = 0
        atBottom.current = false
      })
      later(900, () => mateSay(UNREAD_LINE))
    }
  }, [later, mateSay])

  const onMount = useEffectEvent(() => kick(initial.scene))
  useEffect(() => {
    onMount()
    return clearTimers
  }, [clearTimers])

  function resetTo(next: CallUiScene) {
    clearTimers()
    const history = callUiHistory(next)
    seen.current = new Set(history.map(message => message.id))
    atBottom.current = true
    setScene(next)
    setMessages(history)
    setPending(next === 'waiting')
    setLine(null)
    setSubSpeaking(false)
    setChatTyping(false)
    setUnread(0)
    if (next === 'unread') setChatOpen(true)
    kick(next)
  }

  const replyTyping = chatTyping
  const blocked = pending || replyTyping

  function send(text: string) {
    const value = text.trim()
    if (!value || blocked) return
    setMessages(list => [...list, { id: `u-${Date.now()}`, sender: 'user', text: value, at: Date.now() }])
    setPending(true)
    atBottom.current = true
    setUnread(0)
    const reply = REPLIES[replyIndex.current++ % REPLIES.length]!
    later(1600, () => mateSay(reply))
  }

  // 「누르고 말하기」 (draft): holding shows 「듣는 중」, letting go sends what it pretends to have heard.
  const listeningNow = useRef(false)
  const talkControl: TalkControl = {
    start() {
      if (blocked || listeningNow.current) return
      listeningNow.current = true
      setListening(true)
    },
    end(sendIt: boolean) {
      if (!listeningNow.current) return
      listeningNow.current = false
      setListening(false)
      if (sendIt) send(SPOKEN_SAMPLE)
    },
  }

  function toggleChat() {
    setChatOpen(open => {
      // C2 shows the head bubble only while the chat is closed: opening it ends the bubble (the overlay has the line).
      if (!open && variant === 'c2') setLine(null)
      return !open
    })
  }

  function showNotice(text: string) {
    setNotice(text)
    later(2400, () => setNotice(null))
  }

  // Follow the newest line while the reader is at the bottom (DOM only).
  useLayoutEffect(() => {
    const log = logRef.current
    if (log && atBottom.current) log.scrollTop = log.scrollHeight
  }, [messages.length, pending, chatOpen])

  const onLogProgress = useCallback(() => {
    const log = logRef.current
    if (log && atBottom.current) log.scrollTop = log.scrollHeight
  }, [])
  const onTypingChange = useCallback((_id: string, typing: boolean) => setChatTyping(typing), [])

  const speaking = subSpeaking || chatTyping
  const subtitleVisible = variant !== 'c2' || !chatOpen
  const compact = variant === 'c3' && chatOpen
  const capacity = subtitleCapacity(variant, vw, chatOpen)

  const dock = <Dock
    variant={variant}
    chatOpen={chatOpen}
    voiceOn={voiceOn}
    camera={camera}
    pipOn={pipOn}
    fullscreen={fullscreen}
    listening={listening}
    talkDisabled={blocked}
    onTalk={talkControl}
    onChat={toggleChat}
    onVoice={() => { setVoiceOn(on => !on); if (!voiceOn) showNotice(`메이트 음성 켬 · 답장마다 ${CREDIT_PRICING.voice} 크레딧`) }}
    onCamera={() => setCamera(on => !on)}
    onPip={() => { setPipOn(on => !on); showNotice('시안: PIP 창은 실제 통화 화면에서 열려요') }}
    onFullscreen={() => setFullscreen(on => !on)}
    onSettings={() => showNotice('시안: 설정 창은 실제 통화 화면의 것을 그대로 써요')}
    onLeave={() => showNotice('시안: 연결 끊기 확인 창은 실제 통화 화면의 것을 그대로 써요')}
  />

  const info = <InfoBar
    variant={variant}
    advanced={advanced}
    onMode={setAdvanced}
    talk={talk}
    onTalk={setTalk}
  />

  return <div className="cu-root" data-variant={variant} data-chat={chatOpen ? 'open' : 'closed'} data-speaking={speaking || undefined} data-reduced={reduced || undefined}>
    {variant !== 'c2' && <header className="cu-top">
      <div className="cu-top-left">
        <span className="cu-brand"><Brand /></span>
        <span className="cu-top-divider" aria-hidden="true" />
        <span className="cu-live-dot" aria-hidden="true" />
        <h1 className="cu-mate-name">{CALL_UI_MATE}<span className="sr-only"> · 연결 중</span></h1>
      </div>
      {info}
    </header>}

    <main className="cu-content">
      <div className="cu-stage-wrap">
        <section className="cu-stage" aria-label={CALL_UI_MATE} style={{ background: CALL_STAGE_GRADIENT }}>
          <img src={mateCallBackground(MATE_ID).landscape} alt="" className="cu-stage-bg" draggable={false} />
          <span className="cu-halo" aria-hidden="true" />
          <div className="cu-figure">
            <img src={matePortrait(MATE_ID)} width={1600} height={1200} alt="" draggable={false} />
          </div>

          {variant === 'c2' && <div className="cu-overlay-top">
            <div className="cu-overlay-id">
              <span className="cu-brand cu-brand--small"><Brand /></span>
              <span className="cu-top-divider" aria-hidden="true" />
              <span className="cu-live-dot" aria-hidden="true" />
              <h1 className="cu-mate-name">{CALL_UI_MATE}<span className="sr-only"> · 연결 중</span></h1>
            </div>
            {info}
          </div>}

          {variant === 'c3' && <TalkSegment value={talk} onChange={setTalk} className="cu-talk--stage" />}

          {/* C3: the speaking state belongs to the stage (green inset line + name chip), as today's `.is-speaking`. */}
          {variant === 'c3' && (speaking || pending) && <span className="cu-stage-chip" aria-hidden="true">
            {CALL_UI_MATE}
            {pending ? <><span className="cu-chip-sep" />답장 준비 중 <StageDots /></> : <SpeakingMark />}
          </span>}

          {/* C2 with the chat open: no bubble, so the speaking state is a tag by her head. */}
          {variant === 'c2' && chatOpen && speaking && <span className="cu-head-tag" aria-hidden="true">{CALL_UI_MATE}<SpeakingMark /></span>}
          {variant === 'c2' && pending && !chatOpen && <span className="cu-thought" aria-hidden="true"><StageDots /></span>}

          <SelfTile camera={camera} />

          {subtitleVisible && (line ? <Subtitle
            key={`${line.id}:${compact ? 'c' : 'f'}:${capacity}`}
            variant={variant}
            text={line.text}
            capacity={capacity}
            compact={compact}
            reduced={reduced}
            onSpeaking={setSubSpeaking}
            onDone={() => setLine(current => (current?.id === line.id ? null : current))}
          /> : pending && variant === 'c1' ? <WaitingBox /> : null)}
        </section>
        {notice && <p className="cu-notice" role="status">{notice}</p>}
        {listening && <p className="cu-listening-note" role="status"><span className="cu-level" aria-hidden="true"><span /><span /><span /><span /></span>듣는 중 · 떼면 보내요</p>}
        {dock}
      </div>

      <ChatPanel
        variant={variant}
        open={chatOpen}
        messages={messages}
        pending={pending}
        speaking={speaking}
        unread={unread}
        logRef={logRef}
        seen={seen}
        onProgress={onLogProgress}
        onTypingChange={onTypingChange}
        onScroll={() => {
          const log = logRef.current
          if (!log) return
          atBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48
          if (atBottom.current && unread) setUnread(0)
        }}
        onJump={() => {
          const log = logRef.current
          if (!log) return
          atBottom.current = true
          log.scrollTo({ top: log.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
          setUnread(0)
        }}
        onClose={toggleChat}
        composer={<Composer
          draft={draft}
          onDraft={setDraft}
          onSend={send}
          pending={pending}
          typing={replyTyping}
          listening={listening}
          talk={talkControl}
        />}
      />
    </main>

    {!initial.bar ? null : barOpen ? <nav className="cu-bar" aria-label="통화 화면 시안 조작">
      <strong className="cu-bar-name">{CALL_UI_VARIANT_NAME[variant]}</strong>
      <span className="cu-bar-group" role="group" aria-label="장면">
        {CALL_UI_SCENES.map(item => <button key={item.id} type="button" aria-pressed={scene === item.id} onClick={() => resetTo(item.id)}>{item.label}</button>)}
      </span>
      <span className="cu-bar-group" role="group" aria-label="채팅">
        <button type="button" aria-pressed={chatOpen} onClick={() => { if (!chatOpen) toggleChat() }}>채팅 열림</button>
        <button type="button" aria-pressed={!chatOpen} onClick={() => { if (chatOpen) toggleChat() }}>채팅 닫힘</button>
      </span>
      <button type="button" className="cu-bar-action" onClick={() => resetTo(scene)}>다시 재생</button>
      <button type="button" className="cu-bar-action" aria-label="시안 조작 접기" onClick={() => setBarOpen(false)}><Icon name="close" size={14} /></button>
    </nav> : <button type="button" className="cu-bar-reopen" onClick={() => setBarOpen(true)}>시안 조작</button>}
  </div>
}

/* ── Stage pieces ──────────────────────────────────────────────────────────────────────────────────────────── */

/** 「말하는 중」: three green level bars (voice and mouth assumed to run together) and the words. */
function SpeakingMark() {
  return <span className="cu-speaking"><span className="cu-chip-sep" /><span className="cu-speaking-bars"><span /><span /><span /></span>말하는 중</span>
}

function StageDots() {
  return <span className="cu-stage-dots"><span /><span /><span /></span>
}

function SelfTile({ camera }: { camera: boolean }) {
  return <section className="cu-self" aria-label="내 화면">
    <span className="cu-self-title">{CALL_UI_USER}<span className="cu-self-cam" data-on={camera || undefined} aria-hidden="true"><Icon name={camera ? 'video' : 'videoOff'} size={12} /></span></span>
    <span className="cu-self-avatar"><Icon name="user" size={26} /></span>
  </section>
}

/** C1 while her reply is on its way: the dialogue box with her name and three dots (decoration; the log says it). */
function WaitingBox() {
  return <div className="cu-sub cu-sub--box" data-phase="waiting" aria-hidden="true">
    <span className="cu-sub-frame"><PixelRoofStrip /></span>
    <span className="cu-sub-name">{CALL_UI_MATE}</span>
    <p className="cu-sub-text"><StageDots /></p>
  </div>
}

/**
 * The subtitle: her line typed at the chat's letter pace (TypingMessage), in pages of `capacity` letters (2–3 lines;
 * one line in C3's compact mode). A page holds long enough to read, then the next types; after the last page it stays
 * a few seconds and leaves (a new line replaces it at once: the parent remounts it by key). The text is aria-hidden:
 * the chat log is the live region. The ▼ button skips the typing, then turns the page (Enter / Space as a button).
 */
function Subtitle({ variant, text, capacity, compact, reduced, onSpeaking, onDone }: {
  variant: CallUiVariant
  text: string
  capacity: number
  compact: boolean
  reduced: boolean
  onSpeaking: (speaking: boolean) => void
  onDone: () => void
}) {
  const pages = useMemo(() => subtitlePages(text, Math.max(14, Math.floor(capacity))), [text, capacity])
  const pace = letterPace(text)
  const [page, setPage] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'shown' | 'leaving'>('typing')
  const typed = useRef<HTMLSpanElement>(null)
  const action = useRef<() => void>(() => {})
  const report = useRef(onSpeaking)
  const done = useRef(onDone)
  useEffect(() => { report.current = onSpeaking; done.current = onDone })

  useEffect(() => {
    const frame = requestAnimationFrame(() => report.current(true))
    return () => { cancelAnimationFrame(frame); report.current(false) }
  }, [])

  useEffect(() => {
    const node = typed.current
    if (!node) return
    const letters = Array.from(pages[page] ?? '')
    const last = page >= pages.length - 1
    let frame = 0
    const waits: number[] = []
    const wait = (ms: number, run: () => void) => { waits.push(window.setTimeout(run, ms)) }
    let state: 'typing' | 'shown' = 'typing'
    const leave = () => {
      setPhase('leaving')
      wait(reduced ? 0 : 240, () => done.current())
    }
    const next = () => {
      if (last) leave()
      else { setPhase('typing'); setPage(value => value + 1) }
    }
    const finish = () => {
      cancelAnimationFrame(frame)
      node.textContent = letters.join('')
      state = 'shown'
      setPhase('shown')
      if (last) wait(reduced ? 300 : 420, () => report.current(false))
      const hold = last
        ? Math.min(6000, (compact ? 1600 : 2400) + letters.length * 40)
        : (compact ? 500 : 800) + letters.length * 32
      wait(hold, next)
    }
    action.current = () => { for (const id of waits.splice(0)) clearTimeout(id); if (state === 'typing') finish(); else next() }
    if (reduced) frame = requestAnimationFrame(finish)
    else {
      node.textContent = ''
      let start = 0
      let shown = -1
      const tick = (now: number) => {
        if (!start) start = now
        const count = Math.min(letters.length, Math.floor((now - start) / pace) + 1)
        if (count !== shown) { node.textContent = letters.slice(0, count).join(''); shown = count }
        if (count < letters.length) frame = requestAnimationFrame(tick)
        else finish()
      }
      frame = requestAnimationFrame(tick)
    }
    return () => { cancelAnimationFrame(frame); for (const id of waits) clearTimeout(id) }
  }, [page, pages, pace, reduced, compact])

  const more = page < pages.length - 1
  const kind = variant === 'c1' ? 'box' : variant === 'c2' ? 'bubble' : 'caption'
  // The whole subtitle takes a click (skip / next page); the ▼ button is its keyboard way (its click bubbles here).
  return <div className={cn('cu-sub', `cu-sub--${kind}`)} data-phase={phase} data-compact={compact || undefined} onClick={() => action.current()}>
    <span className="cu-sub-frame" aria-hidden="true">{kind === 'box' && <PixelRoofStrip />}</span>
    {kind !== 'caption' && <span className="cu-sub-name" aria-hidden="true">{CALL_UI_MATE}<SpeakingMark /></span>}
    <p className="cu-sub-text" aria-hidden="true">
      {/* The page's full text keeps the box at its final size while it types. */}
      <span className="cu-sub-measure">{pages[page]}</span>
      <span ref={typed} className="cu-sub-typed" />
    </p>
    <button type="button" className="cu-sub-next" data-more={(more && phase === 'shown') || undefined}>
      <span className="sr-only">{phase === 'typing' ? '자막 바로 보기' : more ? '다음 자막' : '자막 닫기'}</span>
      <span className="cu-sub-arrow" aria-hidden="true" />
    </button>
    {kind === 'bubble' && <span className="cu-sub-tail" aria-hidden="true" />}
  </div>
}

/* ── Info bar ──────────────────────────────────────────────────────────────────────────────────────────────── */

function CallTimer() {
  const [seconds, setSeconds] = useState(12 * 60 + 34)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds(value => value + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = (value: number) => String(value).padStart(2, '0')
  return <time className="cu-timer" aria-label="연결 시간">{pad(Math.floor(seconds / 3600))}:{pad(Math.floor(seconds / 60) % 60)}:{pad(seconds % 60)}</time>
}

function TalkSegment({ value, onChange, className }: { value: TalkFrequency; onChange: (value: TalkFrequency) => void; className?: string }) {
  function onKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = TALK_OPTIONS.findIndex(item => item.value === value)
    const next = TALK_OPTIONS[(index + step + TALK_OPTIONS.length) % TALK_OPTIONS.length]!
    onChange(next.value)
    const group = event.currentTarget.parentElement
    requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
  }
  return <div className={cn('cu-talk', className)} role="radiogroup" aria-label="말 걸기 빈도">
    {TALK_OPTIONS.map(option => <button
      key={option.value}
      type="button"
      role="radio"
      aria-checked={value === option.value}
      tabIndex={value === option.value ? 0 : -1}
      title={option.description}
      onClick={() => onChange(option.value)}
      onKeyDown={onKey}
    >{option.label}</button>)}
  </div>
}

/**
 * One line: mode · credits · time, and 「더 보기」 for what is rarely read (affinity, 말 걸기 빈도 in C1/C2, the
 * screen's note). Credits keep the credit gold (exception 2) through the pixel coin.
 */
function InfoBar({ variant, advanced, onMode, talk, onTalk }: {
  variant: CallUiVariant
  advanced: boolean
  onMode: (advanced: boolean) => void
  talk: TalkFrequency
  onTalk: (value: TalkFrequency) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  const mode = <div className="cu-mode" role="group" aria-label="대화 모드">
    <button type="button" aria-pressed={!advanced} onClick={() => onMode(false)}>기본</button>
    <button type="button" aria-pressed={advanced} onClick={() => onMode(true)} title={`고급 모드는 1턴에 ${CREDIT_PRICING.advanced} 크레딧`}>고급<span className="cu-mode-cost"> · {CREDIT_PRICING.advanced}</span></button>
  </div>
  return <div className="cu-info" ref={wrap}>
    {variant === 'c3' ? mode : <><CallTimer /><span className="cu-info-sep" aria-hidden="true" />{mode}</>}
    <span className="cu-info-sep" aria-hidden="true" />
    <span className="cu-credit" title="오늘 남은 크레딧">
      <PixelImage name="coin" scale={1.5} className="cu-credit-coin" />
      <span className="sr-only">오늘 남은 크레딧 </span>{DEMO_CREDITS.toLocaleString('ko-KR')}
    </span>
    {variant === 'c3' && <><span className="cu-info-sep" aria-hidden="true" /><CallTimer /></>}
    <button
      ref={trigger}
      type="button"
      className="cu-info-more"
      aria-label="연결 정보 더 보기"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen(value => !value)}
    ><Icon name="more" size={16} /></button>
    <div id={panelId} className="cu-info-panel" hidden={!open}>
      <PixelRoofStrip />
      <div className="cu-info-row">
        <span className="cu-info-label"><Icon name="heart" size={14} />친밀도</span>
        <strong>{DEMO_AFFINITY.name}</strong>
        <span className="cu-affinity-steps" aria-hidden="true">
          {Array.from({ length: AFFINITY_STAGE_COUNT }, (_, index) => <span key={index} data-on={index < DEMO_AFFINITY.stage || undefined} />)}
        </span>
        <span className="sr-only">{AFFINITY_STAGE_COUNT}단계 중 {DEMO_AFFINITY.stage}단계</span>
      </div>
      {variant !== 'c3' && <div className="cu-info-row cu-info-row--talk">
        <span className="cu-info-label">말 걸기</span>
        <TalkSegment value={talk} onChange={onTalk} />
      </div>}
      <p className="cu-info-help">카메라 영상은 이 기기 안에서만 확인하고 저장하거나 보내지 않아요.</p>
    </div>
  </div>
}

/* ── Dock ──────────────────────────────────────────────────────────────────────────────────────────────────── */

type TalkControl = { start: () => void; end: (send: boolean) => void }

function DockButton({ icon, label, pressed, expanded, controls, danger, active, disabled, onClick, talk }: {
  icon: IconName
  label: string
  pressed?: boolean
  expanded?: boolean
  controls?: string
  danger?: boolean
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  talk?: TalkControl
}) {
  const holding = useRef(false)
  const hold = talk ? {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || disabled) return
      holding.current = true
      talk.start()
      const up = () => { holding.current = false; talk.end(true); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel) }
      const cancel = () => { holding.current = false; talk.end(false); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel) }
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !disabled) { event.preventDefault(); holding.current = true; talk.start() }
    },
    onKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if ((event.key === ' ' || event.key === 'Enter') && holding.current) { event.preventDefault(); holding.current = false; talk.end(true) }
    },
    onBlur: () => { if (holding.current) { holding.current = false; talk.end(false) } },
  } : {}
  return <button
    type="button"
    className="cu-dock-btn"
    aria-label={label}
    aria-pressed={pressed}
    aria-expanded={expanded}
    aria-controls={controls}
    data-danger={danger || undefined}
    data-active={active || undefined}
    disabled={disabled}
    onClick={talk ? undefined : onClick}
    {...hold}
  >
    <Icon name={icon} size={20} />
    <span className="cu-tip" aria-hidden="true">{label}</span>
  </button>
}

function Dock({ variant, chatOpen, voiceOn, camera, pipOn, fullscreen, listening, talkDisabled, onTalk, onChat, onVoice, onCamera, onPip, onFullscreen, onSettings, onLeave }: {
  variant: CallUiVariant
  chatOpen: boolean
  voiceOn: boolean
  camera: boolean
  pipOn: boolean
  fullscreen: boolean
  listening: boolean
  talkDisabled: boolean
  onTalk: TalkControl
  onChat: () => void
  onVoice: () => void
  onCamera: () => void
  onPip: () => void
  onFullscreen: () => void
  onSettings: () => void
  onLeave: () => void
}) {
  return <div className="cu-dock" role="toolbar" aria-label="연결 컨트롤" data-variant={variant}>
    <div className="cu-dock-group" role="group" aria-label="대화">
      <DockButton icon="microphone" label={listening ? '듣는 중 · 떼면 보내요' : '누르고 말하기'} active={listening} disabled={talkDisabled && !listening} talk={onTalk} />
      <DockButton icon="chat" label={chatOpen ? '채팅 닫기' : '채팅 열기'} pressed={chatOpen} expanded={chatOpen} controls="cu-chat" onClick={onChat} />
      <DockButton icon="headphones" label={voiceOn ? '메이트 음성 끄기' : '메이트 음성 켜기'} pressed={voiceOn} onClick={onVoice} />
    </div>
    <div className="cu-dock-group" role="group" aria-label="기기">
      <DockButton icon={camera ? 'video' : 'videoOff'} label={camera ? '카메라 끄기' : '카메라 켜기'} pressed={camera} onClick={onCamera} />
    </div>
    <div className="cu-dock-group cu-dock-group--screen" role="group" aria-label="화면">
      <DockButton icon="shrink" label="PIP로 띄우기" pressed={pipOn} onClick={onPip} />
      <DockButton icon="expand" label={fullscreen ? '전체 화면 종료' : '전체 화면'} pressed={fullscreen} onClick={onFullscreen} />
      <DockButton icon="sliders" label="설정" onClick={onSettings} />
    </div>
    <div className="cu-dock-leave">
      <DockButton icon="phoneOff" label="연결 끊기" danger onClick={onLeave} />
    </div>
  </div>
}

/* ── Chat ──────────────────────────────────────────────────────────────────────────────────────────────────── */

type Group = { sender: CallUiMessage['sender']; items: CallUiMessage[] }
/** Consecutive messages of one side within 3 minutes form a group: one name, one face. */
function groupMessages(messages: readonly CallUiMessage[]): Group[] {
  const groups: Group[] = []
  for (const message of messages) {
    const last = groups.at(-1)
    const previous = last?.items.at(-1)
    if (last && previous && last.sender === message.sender && message.at - previous.at < 3 * 60_000) last.items.push(message)
    else groups.push({ sender: message.sender, items: [message] })
  }
  return groups
}

function ReplyRow() {
  const [rating, setRating] = useState<'UP' | 'DOWN' | null>(null)
  const [reported, setReported] = useState(false)
  return <span className="cu-reply-actions" data-chosen={rating || reported || undefined}>
    <button type="button" aria-pressed={rating === 'UP'} aria-label={REPLY_ACTIONS_COPY.up} onClick={() => setRating(value => (value === 'UP' ? null : 'UP'))}><Thumb /></button>
    <button type="button" aria-pressed={rating === 'DOWN'} aria-label={REPLY_ACTIONS_COPY.down} onClick={() => setRating(value => (value === 'DOWN' ? null : 'DOWN'))}><Thumb down /></button>
    <button type="button" className="cu-reply-text" aria-pressed={reported} onClick={() => setReported(value => !value)}>{REPLY_ACTIONS_COPY.report}</button>
  </span>
}

function Thumb({ down = false }: { down?: boolean }) {
  return <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
    <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm0 0 4-7a2 2 0 0 1 2.9 2.2L13 9h5.3a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7" />
  </svg>
}

function ChatPanel({ variant, open, messages, pending, speaking, unread, logRef, seen, onProgress, onTypingChange, onScroll, onJump, onClose, composer }: {
  variant: CallUiVariant
  open: boolean
  messages: CallUiMessage[]
  pending: boolean
  speaking: boolean
  unread: number
  logRef: RefObject<HTMLDivElement | null>
  seen: RefObject<Set<string>>
  onProgress: () => void
  onTypingChange: (id: string, typing: boolean) => void
  onScroll: () => void
  onJump: () => void
  onClose: () => void
  composer: ReactNode
}) {
  const groups = groupMessages(messages)
  const newest = messages.at(-1)
  return <aside
    id="cu-chat"
    className="cu-chat"
    data-open={open || undefined}
    aria-labelledby="cu-chat-title"
  >
    {/* Closed, the log stays in the page for screen readers only (it is the live region; the subtitle is not). */}
    <header className="cu-chat-head" hidden={!open}>
      <PixelRoofStrip />
      <h2 id="cu-chat-title">{variant === 'c1' ? '대화 기록' : `${CALL_UI_MATE}와 대화`}</h2>
      <button type="button" className="cu-chat-close" aria-label="채팅 닫기" onClick={onClose}><Icon name="close" size={16} /></button>
    </header>
    <div className="cu-log-wrap">
    <div
      ref={logRef}
      className="cu-log"
      role="log"
      aria-label={`${CALL_UI_MATE}와 대화`}
      aria-live="polite"
      aria-relevant="additions"
      onScroll={onScroll}
    >
      {groups.map(group => <div key={group.items[0]!.id} className="cu-group" data-sender={group.sender}>
        {group.sender === 'mate' && <img src={faceNeutral} width={32} height={32} alt="" className="cu-face" />}
        <div className="cu-group-body">
          {group.sender === 'mate'
            ? <span className="cu-group-name">{CALL_UI_MATE}</span>
            : <span className="sr-only">{CALL_UI_USER}</span>}
          {group.items.map((message, index) => {
            const live = message.sender === 'mate' && message.live
            const newestMate = variant === 'c2' && open && speaking && message === newest && message.sender === 'mate'
            return <article
              key={message.id}
              className="cu-msg"
              data-first={index === 0 || undefined}
              data-last={index === group.items.length - 1 || undefined}
              data-speaking={newestMate || undefined}
            >
              <p className="cu-bubble">
                {live ? <TypingMessage id={message.id} text={message.text} seen={seen} onProgress={onProgress} onTypingChange={onTypingChange} /> : message.text}
              </p>
              <span className="cu-msg-side">
                <time className="cu-time" dateTime={new Date(message.at).toISOString()}>{messageTime(message.at)}</time>
                {open && message.sender === 'mate' && <ReplyRow />}
              </span>
            </article>
          })}
        </div>
      </div>)}
      {pending && <div className="cu-group" data-sender="mate">
        <img src={faceNeutral} width={32} height={32} alt="" className="cu-face" />
        <div className="cu-group-body">
          <span className="cu-group-name">{CALL_UI_MATE}</span>
          <article className="cu-msg" data-first data-last><p className="cu-bubble cu-bubble--typing"><TypingIndicator name={CALL_UI_MATE} /></p></article>
        </div>
      </div>}
    </div>
    {open && unread > 0 && <button type="button" className="cu-new-pill" onClick={onJump}>
      새 메시지{unread > 1 ? ` ${unread}개` : ''} <span aria-hidden="true">↓</span>
    </button>}
    </div>
    {open && composer}
  </aside>
}

function Composer({ draft, onDraft, onSend, pending, typing, listening, talk }: {
  draft: string
  onDraft: (value: string) => void
  onSend: (text: string) => void
  pending: boolean
  typing: boolean
  listening: boolean
  talk: TalkControl
}) {
  const hintId = useId()
  const input = useRef<HTMLTextAreaElement>(null)
  const blocked = pending || typing
  const state = pending ? 'sending' : !draft.trim() || typing ? 'disabled' : 'ready'
  useLayoutEffect(() => {
    const node = input.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 4 * 22 + 20)}px`
  }, [draft])
  function submit(text: string) {
    if (blocked || !text.trim()) return
    onSend(text)
    onDraft('')
  }
  const holding = useRef(false)
  return <div className="cu-composer">
    <div className="cu-quick" role="group" aria-label="빠른 답장">
      {QUICK_REPLIES.map(text => <button key={text} type="button" disabled={blocked} onClick={() => onSend(text)}>{text}</button>)}
    </div>
    <div className="cu-input" data-listening={listening || undefined}>
      <button
        type="button"
        className="cu-input-mic"
        aria-label={listening ? '듣는 중 · 떼면 보내요' : '누르고 말하기'}
        data-active={listening || undefined}
        disabled={blocked && !listening}
        onPointerDown={event => {
          if (event.button !== 0) return
          talk.start()
          const up = () => { talk.end(true); window.removeEventListener('pointerup', up) }
          window.addEventListener('pointerup', up)
        }}
        onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); holding.current = true; talk.start() } }}
        onKeyUp={event => { if ((event.key === ' ' || event.key === 'Enter') && holding.current) { event.preventDefault(); holding.current = false; talk.end(true) } }}
        onBlur={() => { if (holding.current) { holding.current = false; talk.end(false) } }}
      ><Icon name="microphone" size={18} /></button>
      {listening
        ? <p className="cu-input-listening"><span className="cu-level" aria-hidden="true"><span /><span /><span /><span /></span>듣는 중… 떼면 보내요</p>
        : <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={`${CALL_UI_MATE}에게 한마디…`}
          aria-label={`${CALL_UI_MATE}에게 메시지`}
          aria-describedby={hintId}
          onChange={event => onDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(draft) }
          }}
        />}
      <button
        type="button"
        className="cu-send"
        data-state={state}
        aria-label={state === 'sending' ? '답장을 기다리는 중' : '메시지 보내기'}
        aria-busy={state === 'sending' || undefined}
        disabled={state !== 'ready'}
        onClick={() => submit(draft)}
      >{state === 'sending' ? <QuarterRingSpinner className="cu-send-spinner" /> : <Icon name="arrow" size={18} className="cu-send-icon" />}</button>
    </div>
    <p id={hintId} className="cu-hint">
      {pending ? `${CALL_UI_MATE}가 답장하는 중이에요 · 입력은 계속할 수 있어요` : <><kbd>Enter</kbd> 보내기 · <kbd>Shift</kbd>+<kbd>Enter</kbd> 줄바꿈</>}
    </p>
  </div>
}
