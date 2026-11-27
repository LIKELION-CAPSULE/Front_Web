import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import { cn } from '@/shared/lib/cn'
import { withParticle } from '@/shared/lib/korean'
import { Brand } from '@/shared/ui/Brand'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { PixelImage, PixelRoofStrip } from '@/shared/ui/pixel/PixelFrame'
import type { PixelArtName } from '@/shared/ui/pixel/pixel-art'
import { TypingMessage } from '@/features/session/components/TypingMessage'
import { TypingIndicator } from '@/features/session/components/TypingIndicator'
import { CallDialogueBox } from '@/features/mates/components/CallDialogueBox'
import type { StageLine } from '@/features/mates/call-dialogue'
import { CALL_STAGE_GRADIENT, mateAvatar, mateCallBackground, matePortrait } from '@/features/mates/artwork'
import {
  CHAT_PANEL_STATES, CHAT_PANEL_VARIANT_NAME, DRAFT_MATE, DRAFT_QUICK, DRAFT_QUICK_MORE, DRAFT_REPLIES, DRAFT_SPOKEN,
  DRAFT_STARTERS, DRAFT_USER, GREETING_LINE, chatBlocks, clock, dividerLabel, draftHistory, runTime,
  type ChatPanelState, type ChatPanelVariant, type DraftBlock, type DraftLine,
} from './script'
import '../call-ui/call-ui.css'
import './chat-panel.css'

/**
 * Call-screen chat panel drafts (2026-11-27, review catalog only: `chat-panel-p1|p2|p3`). The stage is the C1 draft's
 * (call-ui.css) with the real `CallDialogueBox` on it, so the panel is judged next to the dialogue box it follows:
 * - P1 「픽셀 대화 기록」: the dialogue box's pixel language carried into the log (stepped bubbles and tails, a dithered
 *   roof, day dividers, name tags). Needs the stepped-corner rule widened (modal + dialogue box → + chat bubbles).
 * - P2 「무드 패널」: the room's light continued behind the panel, a starter screen when nothing was said, bubbles that
 *   rise in, app lines (affinity up, time studied together).
 * - P3 「메신저형 정돈」: a messenger's order (runs with one time, 읽음 / 입력 중, the mate's mini profile, quick
 *   replies in a sideways row, a send button that stands out).
 * Nothing here is used by the product (ConnectionPage is untouched). URL: `?cp-state=empty|few|long`, `cp-bar=0`.
 */

const MATE_ID = 'chaerin'
const MATE_FACE = mateAvatar(MATE_ID)!
const TITLE = `${withParticle(DRAFT_MATE, '과', '와')} 대화`

function readParams() {
  const params = new URLSearchParams(location.search)
  const state = params.get('cp-state')
  return {
    state: (CHAT_PANEL_STATES.some(item => item.id === state) ? state : 'few') as ChatPanelState,
    bar: params.get('cp-bar') !== '0',
  }
}

/* ── Root: the review bar and one scene per state ─────────────────────────────────────────────────────────── */

export function ChatPanelPreview({ variant }: { variant: ChatPanelVariant }) {
  const [initial] = useState(readParams)
  const [state, setState] = useState<ChatPanelState>(initial.state)
  const [round, setRound] = useState(0)
  const [barOpen, setBarOpen] = useState(true)
  return <>
    <Scene key={`${state}:${round}`} variant={variant} state={state} />
    {!initial.bar ? null : barOpen ? <nav className="cu-bar" aria-label="채팅 패널 시안 조작">
      <strong className="cu-bar-name">{CHAT_PANEL_VARIANT_NAME[variant]}</strong>
      <span className="cu-bar-group" role="group" aria-label="상태">
        {CHAT_PANEL_STATES.map(item => <button key={item.id} type="button" aria-pressed={state === item.id} onClick={() => { setState(item.id); setRound(value => value + 1) }}>{item.label}</button>)}
      </span>
      <button type="button" className="cu-bar-action" onClick={() => setRound(value => value + 1)}>다시 재생</button>
      <button type="button" className="cu-bar-action" aria-label="시안 조작 접기" onClick={() => setBarOpen(false)}><CloseGlyph /></button>
    </nav> : <button type="button" className="cu-bar-reopen" onClick={() => setBarOpen(true)}>시안 조작</button>}
  </>
}

function Scene({ variant, state }: { variant: ChatPanelVariant; state: ChatPanelState }) {
  const [lines, setLines] = useState<DraftLine[]>(() => draftHistory(state))
  const [pending, setPending] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [chatTyping, setChatTyping] = useState(false)
  const [stageTyping, setStageTyping] = useState(false)
  const [stageLine, setStageLine] = useState<StageLine | null>(() => {
    const last = draftHistory(state).findLast(line => line.sender === 'mate')
    return { key: last?.id ?? 'greeting', text: last?.text ?? GREETING_LINE, at: last?.at ?? 0 }
  })
  const logRef = useRef<HTMLDivElement>(null)
  const seen = useRef(new Set<string>(lines.map(line => line.id)))
  const timers = useRef<number[]>([])
  const replyIndex = useRef(0)
  const clockAt = useRef(lines.at(-1)?.at ?? Date.UTC(2026, 10, 27, 14, 39))

  useEffect(() => () => { for (const id of timers.current) clearTimeout(id) }, [])
  const later = (ms: number, run: () => void) => { timers.current.push(window.setTimeout(run, ms)) }

  const blocked = pending || chatTyping
  function send(text: string, quick = false) {
    const value = text.trim()
    if (!value || blocked) return
    clockAt.current += 60_000
    const id = `u-${clockAt.current}-${lines.length}`
    setLines(list => [...list, { id, sender: 'user', text: value, at: clockAt.current, read: false }])
    setPending(true)
    setChosen(quick ? value : null)
    // As the call: my word closes her line on the stage and the box waits for the reply.
    setStageLine(null)
    later(700, () => setLines(list => list.map(line => (line.id === id ? { ...line, read: true } : line))))
    later(1900, () => {
      const reply = DRAFT_REPLIES[replyIndex.current++ % DRAFT_REPLIES.length]!
      const replyId = `m-${clockAt.current}-${replyIndex.current}`
      setLines(list => [...list, { id: replyId, sender: 'mate', text: reply, at: clockAt.current, live: true }])
      setPending(false)
      setChosen(null)
      setStageLine({ key: replyId, text: reply, at: clockAt.current })
    })
  }

  // Follow the newest line (the long state opens at the bottom, as a log does).
  useLayoutEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lines.length, pending, chatOpen])
  const onProgress = useCallback(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [])
  const onTypingChange = useCallback((_id: string, typing: boolean) => setChatTyping(typing), [])

  const speaking = stageTyping || chatTyping
  const panel: PanelProps = {
    lines, pending, chosen, blocked, logRef, seen, onProgress, onTypingChange, onSend: send, onClose: () => setChatOpen(false),
  }

  return <div className="cu-root cp-root" data-variant="c1" data-panel={variant} data-chat={chatOpen ? 'open' : 'closed'}>
    <header className="cu-top">
      <div className="cu-top-left">
        <span className="cu-brand"><Brand /></span>
        <span className="cu-top-divider" aria-hidden="true" />
        <span className="cu-live-dot" aria-hidden="true" />
        <h1 className="cu-mate-name">{DRAFT_MATE}<span className="sr-only"> · 연결 중</span></h1>
      </div>
      <div className="cu-info">
        <time className="cu-timer" aria-label="연결 시간">00:12:34</time>
        <span className="cu-info-sep" aria-hidden="true" />
        <span className="cu-credit" title="오늘 남은 크레딧">
          <PixelImage name="coin" scale={1.5} className="cu-credit-coin" />
          <span className="sr-only">오늘 남은 크레딧 </span>1,180
        </span>
        <span className="cp-info-pad" aria-hidden="true" />
      </div>
    </header>

    <main className="cu-content">
      <div className="cu-stage-wrap">
        <section className="cu-stage" aria-label={DRAFT_MATE} style={{ background: CALL_STAGE_GRADIENT }}>
          <img src={mateCallBackground(MATE_ID).landscape} alt="" className="cu-stage-bg" draggable={false} />
          <div className="cu-figure">
            <img src={matePortrait(MATE_ID)} width={1600} height={1200} alt="" draggable={false} />
          </div>
          <section className="cu-self" aria-label="내 화면">
            <span className="cu-self-title">{DRAFT_USER}<span className="cu-self-cam" aria-hidden="true"><Icon name="videoOff" size={12} /></span></span>
            <span className="cu-self-avatar"><Icon name="user" size={26} /></span>
          </section>
          {/* The product's dialogue box (C1, call UI step 2), as it is: the panel drafts follow its language. */}
          <CallDialogueBox
            name={DRAFT_MATE}
            line={stageLine}
            waiting={pending}
            speaking={speaking}
            persist
            onTypingChange={setStageTyping}
          />
          <div className="cu-dock" role="toolbar" aria-label="연결 컨트롤">
            <div className="cu-dock-group" role="group" aria-label="대화">
              <DockButton icon="microphone" label="누르고 말하기" onClick={() => send(DRAFT_SPOKEN)} />
              <DockButton icon="chat" label={chatOpen ? '채팅 닫기' : '채팅 열기'} pressed={chatOpen} onClick={() => setChatOpen(open => !open)} />
              <DockButton icon="headphones" label="메이트 음성 끄기" pressed />
            </div>
            <div className="cu-dock-group" role="group" aria-label="기기">
              <DockButton icon="videoOff" label="카메라 켜기" pressed={false} />
            </div>
            <div className="cu-dock-group" role="group" aria-label="화면">
              <DockButton icon="shrink" label="PIP로 띄우기" pressed={false} />
              <DockButton icon="expand" label="전체 화면" pressed={false} />
              <DockButton icon="sliders" label="설정" />
            </div>
            <div className="cu-dock-leave"><DockButton icon="phoneOff" label="연결 끊기" danger /></div>
          </div>
        </section>
      </div>

      {chatOpen && (variant === 'p1' ? <PixelLogPanel {...panel} /> : variant === 'p2' ? <MoodPanel {...panel} /> : <MessengerPanel {...panel} />)}
    </main>
  </div>
}

function DockButton({ icon, label, pressed, danger, onClick }: { icon: IconName; label: string; pressed?: boolean; danger?: boolean; onClick?: () => void }) {
  return <button type="button" className="cu-dock-btn" aria-label={label} aria-pressed={pressed} data-danger={danger || undefined} onClick={onClick}>
    <Icon name={icon} size={20} />
    <span className="cu-tip" aria-hidden="true">{label}</span>
  </button>
}

/** A still X: the drafts' close buttons do not turn (the X turn is leaving the whole app, another task). */
function CloseGlyph({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="cp-close-glyph">
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
}

/* ── Shared panel parts ───────────────────────────────────────────────────────────────────────────────────── */

type PanelProps = {
  lines: DraftLine[]
  pending: boolean
  /** The quick reply on its way (shown chosen until her reply arrives). */
  chosen: string | null
  blocked: boolean
  logRef: RefObject<HTMLDivElement | null>
  seen: RefObject<Set<string>>
  onProgress: () => void
  onTypingChange: (id: string, typing: boolean) => void
  onSend: (text: string, quick?: boolean) => void
  onClose: () => void
}

function LineText({ line, seen, onProgress, onTypingChange }: Pick<PanelProps, 'seen' | 'onProgress' | 'onTypingChange'> & { line: DraftLine }) {
  return line.live
    ? <TypingMessage id={line.id} text={line.text} seen={seen} onProgress={onProgress} onTypingChange={onTypingChange} />
    : <>{line.text}</>
}

function Log({ logRef, className, children }: { logRef: RefObject<HTMLDivElement | null>; className: string; children: ReactNode }) {
  return <div ref={logRef} className={cn('cp-log', className)} role="log" aria-label={TITLE} aria-live="polite" aria-relevant="additions" tabIndex={0}>
    {children}
  </div>
}

/** Mic · text box · send, and the key hint: autosize to four lines, Enter sends, Shift+Enter breaks the line. */
function DraftField({ prefix, placeholder, pending, blocked, onSend }: {
  prefix: 'cp1' | 'cp2' | 'cp3'
  placeholder: string
  pending: boolean
  blocked: boolean
  onSend: (text: string) => void
}) {
  const hintId = useId()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const node = input.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 4 * 22 + 18)}px`
  }, [draft])
  const ready = !!draft.trim() && !blocked
  function submit() {
    if (!ready) return
    onSend(draft)
    setDraft('')
  }
  return <>
    <div className={`${prefix}-input`}>
      <button type="button" className={`${prefix}-mic`} aria-label="누르고 말하기" disabled={blocked} onClick={() => onSend(DRAFT_SPOKEN)}><Icon name="microphone" size={18} /></button>
      <textarea
        ref={input}
        rows={1}
        value={draft}
        placeholder={placeholder}
        aria-label={`${DRAFT_MATE}에게 메시지`}
        aria-describedby={hintId}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
        }}
      />
      <SendButton className={`${prefix}-send`} ready={ready} pending={pending} onClick={submit} />
    </div>
    <Hint id={hintId} pending={pending} className={`cp-hint ${prefix}-hint`} />
  </>
}

function SendButton({ ready, pending, onClick, className }: { ready: boolean; pending: boolean; onClick: () => void; className: string }) {
  const state = pending ? 'sending' : ready ? 'ready' : 'disabled'
  return <button
    type="button"
    className={className}
    data-state={state}
    aria-label={state === 'sending' ? '답장을 기다리는 중' : '메시지 보내기'}
    aria-busy={state === 'sending' || undefined}
    disabled={state !== 'ready'}
    onClick={onClick}
  >{state === 'sending' ? <QuarterRingSpinner className="cp-send-spinner" /> : <Icon name="arrow" size={18} className="cp-send-icon" />}</button>
}

function Hint({ id, pending, className }: { id: string; pending: boolean; className: string }) {
  return <p id={id} className={className}>
    {pending ? `${DRAFT_MATE}가 답장하는 중이에요 · 입력은 계속할 수 있어요` : <><kbd>Enter</kbd> 보내기 · <kbd>Shift</kbd>+<kbd>Enter</kbd> 줄바꿈</>}
  </p>
}

/* ── P1 「픽셀 대화 기록」 ──────────────────────────────────────────────────────────────────────────────────── */

function PixelLogPanel(props: PanelProps) {
  const { lines, pending, chosen, blocked, logRef, onSend, onClose } = props
  const blocks = chatBlocks(lines, { system: false })
  return <aside className="cp-panel cp1" aria-labelledby="cp-title">
    <span className="cp1-frame" aria-hidden="true" />
    <header className="cp1-head">
      <span className="cp1-roof" aria-hidden="true"><PixelImage name="capsule" /></span>
      <div className="cp1-title-row">
        <h2 id="cp-title">{TITLE}</h2>
        <button type="button" className="cp-close cp1-close" aria-label="대화창 닫기" onClick={onClose}><CloseGlyph /></button>
      </div>
    </header>
    <Log logRef={logRef} className="cp1-log">
      {blocks.length === 0 && !pending && <div className="cp1-empty">
        <PixelImage name="capsule" scale={3} className="cp1-empty-art" />
        <p className="cp1-empty-title">아직 기록이 없어요</p>
        <p className="cp1-empty-text">대사창에 뜬 말에 답하면<br />여기에 차곡차곡 남아요</p>
      </div>}
      {blocks.map(block => <PixelBlock key={block.key} block={block} {...props} />)}
      {pending && <div className="cp1-group" data-sender="mate">
        <span className="cp1-face" aria-hidden="true"><img src={MATE_FACE} alt="" width={32} height={32} /></span>
        <div className="cp1-group-body">
          {!endsWithMate(blocks) && <span className="cp1-name">{DRAFT_MATE}</span>}
          <p className="cp1-bubble cp1-bubble--typing" data-first><span className="cp1-dots" aria-hidden="true"><span /><span /><span /></span><span className="sr-only">{DRAFT_MATE}님이 답장을 준비하고 있어요.</span></p>
        </div>
      </div>}
    </Log>
    <div className="cp1-composer">
      <div className="cp1-quick" role="group" aria-label="빠른 답장">
        {DRAFT_QUICK.map(text => <button key={text} type="button" aria-pressed={chosen === text} disabled={blocked && chosen !== text} onClick={() => onSend(text, true)}>{text}</button>)}
      </div>
      <DraftField prefix="cp1" placeholder={`${DRAFT_MATE}에게 한마디…`} pending={pending} blocked={blocked} onSend={onSend} />
    </div>
  </aside>
}

function endsWithMate(blocks: readonly DraftBlock[]) {
  const last = blocks.at(-1)
  return last?.kind === 'group' && last.sender === 'mate'
}

function PixelBlock({ block, seen, onProgress, onTypingChange }: PanelProps & { block: DraftBlock }) {
  if (block.kind === 'divider') return <p className="cp1-divider"><span>{dividerLabel(block.at)}</span></p>
  if (block.kind === 'system') return null
  return <div className="cp1-group" data-sender={block.sender}>
    {block.sender === 'mate' && <span className="cp1-face" aria-hidden="true"><img src={MATE_FACE} alt="" width={32} height={32} /></span>}
    <div className="cp1-group-body">
      {block.sender === 'mate' ? <span className="cp1-name">{DRAFT_MATE}</span> : <span className="sr-only">{DRAFT_USER}</span>}
      {block.lines.map((line, index) => <article key={line.id} className="cp1-msg" data-first={index === 0 || undefined}>
        <p className="cp1-bubble" data-first={index === 0 || undefined}><LineText line={line} seen={seen} onProgress={onProgress} onTypingChange={onTypingChange} /></p>
        {index === block.lines.length - 1 && <time className="cp1-time" dateTime={new Date(line.at).toISOString()}>{clock(line.at)}</time>}
      </article>)}
    </div>
  </div>
}

/* ── P2 「무드 패널」 ─────────────────────────────────────────────────────────────────────────────────────── */

/** Stars around the capsule of the empty state: x / y in % of the art box, the picture, its twinkle delay. */
const MOOD_STARS: readonly { x: number; y: number; art: PixelArtName; at: number }[] = [
  { x: 6, y: 18, art: 'spark', at: 0 },
  { x: 86, y: 8, art: 'snowFlakeLilac', at: 0.7 },
  { x: 94, y: 62, art: 'spark', at: 1.3 },
  { x: 14, y: 78, art: 'snowDotLilac', at: 0.4 },
  { x: 72, y: 92, art: 'snowDot', at: 1.8 },
  { x: 40, y: 0, art: 'snowDot', at: 2.2 },
]

function MoodPanel(props: PanelProps) {
  const { lines, pending, chosen, blocked, logRef, onSend, onClose, seen, onProgress, onTypingChange } = props
  const blocks = chatBlocks(lines, { system: true })
  // Lines there when the panel opened stay still; what arrives after rises in.
  const [initial] = useState(() => new Set(lines.map(line => line.id)))
  const empty = blocks.length === 0 && !pending
  return <aside className="cp-panel cp2" aria-labelledby="cp-title" data-empty={empty || undefined}>
    <span className="cp2-mood" aria-hidden="true">
      <img src={mateCallBackground(MATE_ID).landscape} alt="" draggable={false} />
    </span>
    <header className="cp2-head">
      <PixelRoofStrip />
      <h2 id="cp-title">{TITLE}</h2>
      <button type="button" className="cp-close cp2-close" aria-label="대화창 닫기" onClick={onClose}><CloseGlyph /></button>
    </header>
    <Log logRef={logRef} className="cp2-log">
      {empty && <div className="cp2-empty">
        <span className="cp2-empty-art" aria-hidden="true">
          <PixelImage name="capsule" scale={4} className="cp2-capsule" />
          {MOOD_STARS.map((star, index) => <PixelImage
            key={index}
            name={star.art}
            className="cp2-star"
            style={{ left: `${star.x}%`, top: `${star.y}%`, animationDelay: `${star.at}s` }}
          />)}
        </span>
        <p className="cp2-empty-title">{DRAFT_MATE}에게 먼저 말 걸어 볼까요?</p>
        <p className="cp2-empty-text">아래 한마디를 눌러도 되고,<br />마이크를 눌러 말해도 돼요.</p>
        <div className="cp2-starters" role="group" aria-label="첫마디">
          {DRAFT_STARTERS.map(text => <button key={text} type="button" aria-pressed={chosen === text} disabled={blocked} onClick={() => onSend(text, true)}>{text}</button>)}
        </div>
      </div>}
      {blocks.map(block => block.kind === 'divider'
        ? <p key={block.key} className="cp2-divider">{dividerLabel(block.at)}</p>
        : block.kind === 'system'
          ? <p key={block.key} className="cp2-system" data-kind={block.line.system} data-new={!initial.has(block.line.id) || undefined}>
            <Icon name={block.line.system === 'affinity' ? 'heart' : 'clock'} size={14} className="cp2-system-icon" />
            {block.line.text}
          </p>
          : <div key={block.key} className="cp2-group" data-sender={block.sender}>
            {block.sender === 'mate' && <img src={MATE_FACE} alt="" width={32} height={32} className="cp2-face" />}
            <div className="cp2-group-body">
              {block.sender === 'mate' ? <span className="cp2-name">{DRAFT_MATE}</span> : <span className="sr-only">{DRAFT_USER}</span>}
              {block.lines.map((line, index) => <article
                key={line.id}
                className="cp2-msg"
                data-first={index === 0 || undefined}
                data-last={index === block.lines.length - 1 || undefined}
                data-new={!initial.has(line.id) || undefined}
              >
                <p className="cp2-bubble"><LineText line={line} seen={seen} onProgress={onProgress} onTypingChange={onTypingChange} /></p>
                <time className="cp2-time" dateTime={new Date(line.at).toISOString()}>{clock(line.at)}</time>
              </article>)}
            </div>
          </div>)}
      {pending && <div className="cp2-group" data-sender="mate">
        <img src={MATE_FACE} alt="" width={32} height={32} className="cp2-face" />
        <div className="cp2-group-body">
          <article className="cp2-msg" data-first data-last data-new><p className="cp2-bubble cp2-bubble--typing"><TypingIndicator name={DRAFT_MATE} /></p></article>
        </div>
      </div>}
    </Log>
    <div className="cp2-composer">
      {!empty && <div className="cp2-quick" role="group" aria-label="빠른 답장">
        {DRAFT_QUICK.map(text => <button key={text} type="button" aria-pressed={chosen === text} disabled={blocked && chosen !== text} onClick={() => onSend(text, true)}>{text}</button>)}
      </div>}
      <DraftField prefix="cp2" placeholder={`${DRAFT_MATE}에게 한마디…`} pending={pending} blocked={blocked} onSend={onSend} />
    </div>
  </aside>
}

/* ── P3 「메신저형 정돈」 ──────────────────────────────────────────────────────────────────────────────────── */

function MessengerPanel(props: PanelProps) {
  const { lines, pending, chosen, blocked, logRef, onSend, onClose, seen, onProgress, onTypingChange } = props
  const blocks = chatBlocks(lines, { system: false })
  const typing = pending
  // 「읽음」 under my newest run only, once she has read it.
  const lastMine = lines.findLast(line => line.sender === 'user')
  return <aside className="cp-panel cp3" aria-labelledby="cp-title">
    <header className="cp3-head">
      <PixelRoofStrip />
      <span className="cp3-avatar" aria-hidden="true">
        <img src={MATE_FACE} alt="" width={36} height={36} />
        <span className="cp3-status-dot" />
      </span>
      <div className="cp3-who">
        <h2 id="cp-title">{DRAFT_MATE}<span className="sr-only">와 대화</span></h2>
        <p className="cp3-status" aria-live="polite">
          {typing ? <><span className="cp3-status-typing" aria-hidden="true"><span /><span /><span /></span>입력 중</> : '통화 중 · 함께 12분'}
        </p>
      </div>
      <button type="button" className="cp-close cp3-close" aria-label="대화창 닫기" onClick={onClose}><CloseGlyph /></button>
    </header>
    <Log logRef={logRef} className="cp3-log">
      {blocks.length === 0 && !pending && <div className="cp3-empty">
        <img src={MATE_FACE} alt="" width={56} height={56} className="cp3-empty-face" />
        <p className="cp3-empty-title">{DRAFT_MATE}와 대화를 시작해요</p>
        <p className="cp3-empty-text">주고받은 말은 여기에 남아요</p>
      </div>}
      {blocks.map(block => block.kind === 'divider'
        ? <p key={block.key} className="cp3-divider"><span>{dividerLabel(block.at)}</span></p>
        : block.kind === 'system' ? null
          : <div key={block.key} className="cp3-group" data-sender={block.sender}>
            {block.sender === 'mate' && <img src={MATE_FACE} alt="" width={28} height={28} className="cp3-face" />}
            <div className="cp3-group-body">
              {block.sender === 'mate' ? <span className="cp3-name">{DRAFT_MATE}</span> : <span className="sr-only">{DRAFT_USER}</span>}
              {block.lines.map((line, index) => {
                const last = index === block.lines.length - 1
                return <article key={line.id} className="cp3-msg" data-first={index === 0 || undefined} data-last={last || undefined}>
                  <p className="cp3-bubble"><LineText line={line} seen={seen} onProgress={onProgress} onTypingChange={onTypingChange} /></p>
                  {last && <span className="cp3-meta">
                    {line === lastMine && <span className="cp3-read" data-read={line.read || undefined}>{line.read ? '읽음' : '보냄'}</span>}
                    <time dateTime={new Date(line.at).toISOString()}>{runTime(line.at)}</time>
                  </span>}
                </article>
              })}
            </div>
          </div>)}
      {pending && <div className="cp3-group" data-sender="mate">
        <img src={MATE_FACE} alt="" width={28} height={28} className="cp3-face" />
        <div className="cp3-group-body">
          <article className="cp3-msg" data-first data-last><p className="cp3-bubble cp3-bubble--typing"><TypingIndicator name={DRAFT_MATE} /></p></article>
        </div>
      </div>}
    </Log>
    <div className="cp3-composer">
      <div className="cp3-quick" role="group" aria-label="빠른 답장">
        {DRAFT_QUICK_MORE.map(text => <button key={text} type="button" aria-pressed={chosen === text} disabled={blocked && chosen !== text} onClick={() => onSend(text, true)}>{text}</button>)}
      </div>
      <DraftField prefix="cp3" placeholder={`${DRAFT_MATE}에게 메시지`} pending={pending} blocked={blocked} onSend={onSend} />
    </div>
  </aside>
}
