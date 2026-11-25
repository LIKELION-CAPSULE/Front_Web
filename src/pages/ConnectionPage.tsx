import { startTransition, useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useSessionSync } from '@/features/backend/use-session-sync'
import { useDemo } from '@/features/demo/demo-context'
import { sessionStudySeconds } from '@/features/session/connection-time'
import { useMedia } from '@/features/media/media-context'
import { availableMates } from '@/features/mates/catalog'
import { selectLeaveQuote } from '@/features/mates/mate-contract'
import { ConnectionIdleClock } from '@/features/mates/connection-idle'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { ConnectionPip } from '@/features/mates/components/ConnectionPip'
import { useDocumentPip } from '@/features/mates/use-document-pip'
import AccountSettingsDialog from '@/features/profile/components/AccountSettingsDialog'
import { withParticle } from '@/shared/lib/korean'
import { CALL_STAGE_GRADIENT, mateCallBackground, mateHeroPortrait, matePortrait } from '@/features/mates/artwork'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useExpressionDirector } from '@/features/live2d/use-live2d'
import { useNow } from '@/features/session/use-now'
import { ChatComposer } from '@/features/session/components/ChatComposer'
import { TypingIndicator } from '@/features/session/components/TypingIndicator'
import { TypingMessage } from '@/features/session/components/TypingMessage'
import { CharacterSpeechBubble } from '@/features/session/components/CharacterSpeechBubble'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { GlassDock, type GlassDockItem } from '@/shared/ui/dock/GlassDock'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { AnimatedClock } from '@/shared/ui/AnimatedClock'
import { clock } from '@/shared/lib/format'
import { ApiError } from '@/shared/api/client'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import NotFoundPage from './NotFoundPage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'
import { useConnectionPreferences } from '@/features/mates/connection-preferences-context'
import { PIP_WINDOW_SIZE, TALK_OPTIONS } from '@/features/mates/connection-preferences'
import { usePushToTalk } from '@/features/mates/use-push-to-talk'
import { PUSH_TO_TALK_TEXT } from '@/features/mates/push-to-talk'
import { AFFINITY_STAGE_COUNT, resolveMateFeatures } from '@/features/mates/mate-features'
import { DevicePrivacyInfo } from '@/features/media/components/DevicePrivacyInfo'
import { Brand } from '@/shared/ui/Brand'
import { MateTap, onMate } from '@/features/mates/mate-tap'
import { playHangup, whenRendered, type HangupPlayback } from '@/features/mates/hangup-sequence'
import hangupHandset from '@/assets/connection/hangup-handset-3d.webp'
import hangupHandsetRed from '@/assets/connection/hangup-handset-3d-red.webp'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> }
}


/**
 * The 「?」 note of the connection screen: what the camera and the microphone do here, what is sent where, how
 * 「카메라로 함께한 시간」 counts and what costs credits (checked against the code: vision.worker.ts runs face detection
 * on the device and only state events go to the server; the microphone is only used by 누르고 말하기 — Web Speech API).
 * Wording to be confirmed with the user and legal.
 */
function ConnectionHelpNote() {
  return (
    <div className="connection-help-note">
      <p>카메라를 켜면 이 기기 안에서 얼굴을 감지해 자리에 있는지 알아봐요. 영상은 서버로 보내거나 저장하지 않고, 자리 비움·돌아옴 같은 상태만 보내요.</p>
      <p>마이크는 「누르고 말하기」를 누르는 동안에만 써요. 그 음성은 브라우저의 음성 인식 서비스로 보내져 글자로 바뀌고, 바뀐 글자가 채팅으로 보내져요.</p>
      <p>「카메라로 함께한 시간」은 카메라에 얼굴이 보인 시간만 세요. 10초 넘게 보이지 않으면 메이트가 자리 비움으로 알아채요.</p>
      <p>크레딧은 기본 대화 0, 고급 대화 한 턴에 {CREDIT_PRICING.advanced}이에요. 음성 대화는 준비 중이에요.</p>
    </div>
  )
}

/** The label before the heard sentence above the dock. */
const STT_LABEL: Record<string, string> = { listening: '듣는 중', finishing: '듣는 중', confirm: '보낼게요', sending: '보내는 중', unsent: '못 보냈어요', idle: '' }

/** The first-use notice of 누르고 말하기; it counts as seen once it has been on screen. */
function SttPrivacy({ onShown }: { onShown: () => void }) {
  useEffect(() => { onShown() }, [onShown])
  return <p className="connection-stt-privacy">{PUSH_TO_TALK_TEXT.privacy}</p>
}

/** Connections whose starting mode (T-7) was applied in this page load (a reload or remount keeps the call's mode). */
const modeAppliedFor = new Set<string>()

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ConnectionPage() {
  const { mateId } = useParams()
  const navigate = useNavigate()
  const backend = useBackend()
  const { showPipSpeech, settings, updateSettings } = useConnectionPreferences()
  // 「말 걸기 빈도」 on the stage: a short note of what the choice means, for a moment after choosing.
  const [talkNote, setTalkNote] = useState('')
  useEffect(() => {
    if (!talkNote) return
    const timer = setTimeout(() => setTalkNote(''), 1500)
    return () => clearTimeout(timer)
  }, [talkNote])
  const chooseTalk = (value: (typeof TALK_OPTIONS)[number]['value']) => {
    updateSettings({ talk: value })
    setTalkNote(TALK_OPTIONS.find((option) => option.value === value)?.description ?? '')
  }
  const { state } = useDemo()
  const { devices, controller, observation, flushFocus } = useMedia()
  const mate = availableMates(backend.home).find(value => value.id === mateId)
  const active = state.activeSession?.mateId === mateId ? state.activeSession : null
  // While the hang-up plays, the ended session keeps the call on screen: /end clears `activeSession` on success.
  const [ending, setEnding] = useState<{ session: NonNullable<typeof active>; at: number } | null>(null)
  const [endingWait, setEndingWait] = useState(false)
  const shown = active ?? ending?.session ?? null
  const pageRef = useRef<HTMLElement>(null)
  const hangup = useRef<HangupPlayback | null>(null)
  useEffect(() => () => { hangup.current?.cancel(); hangup.current = null }, [])
  const now = useNow()
  const [chatOpen, setChatOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 960 : true))
  const [infoMenuOpen, setInfoMenuOpen] = useState(false)
  const infoMenuRef = useRef<HTMLDivElement>(null)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // A tap on the mate (mate-tap.ts): her face for a moment, a nod and one of her lines; no server, no credits.
  const [tapper] = useState(() => new MateTap())
  const [stillBounce, setStillBounce] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [error, setError] = useState('')
  const [speech, setSpeech] = useState({ id: 0, at: 0, text: '' })
  const [speakingMessages, setSpeakingMessages] = useState<ReadonlySet<string>>(new Set())
  const speaking = speakingMessages.size > 0
  /** The event bubble's line is typing (CharacterSpeechBubble: on while letters appear, off when done/skipped/gone). */
  const [bubbleTyping, setBubbleTyping] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacySeen, setPrivacySeen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bgFailed, setBgFailed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  )
  const pip = useDocumentPip()
  const camera = devices.camera.stream
  const video = useRef<HTMLVideoElement>(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])
  useEffect(() => {
    if (!infoMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!infoMenuRef.current?.contains(target)) setInfoMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInfoMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [infoMenuOpen])
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (document.querySelector('dialog:modal')) return
      const target = event.target
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (editing) return
      const key = event.code === 'KeyC' ? 'c' : event.key.toLowerCase()
      if (key === 'c') {
        event.preventDefault()
        setChatOpen(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
  const idle = useRef(new ConnectionIdleClock(0))
  const attemptedIdleEnd = useRef(false)
  const messageList = useRef<HTMLDivElement>(null)
  const followMessages = useRef(true)
  const seenMessages = useRef(new Set(state.messages.map(message => message.id)))
  const scrollLatest = useCallback(() => {
    if (followMessages.current && messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight
  }, [])
  const reportTyping = useCallback((messageId: string, typing: boolean) => {
    setSpeakingMessages(current => {
      if (current.has(messageId) === typing) return current
      const next = new Set(current)
      if (typing) next.add(messageId)
      else next.delete(messageId)
      return next
    })
  }, [])
  const expressions = useExpressionDirector(backend.live2dStage)
  // T-10: the mate's gaze follows the mouse (the stage eases it and returns to the front when the pointer rests or
  // leaves; reduced motion keeps the face forward).
  useEffect(() => {
    const stage = backend.live2dStage
    stage?.setTracking(settings.gaze && !prefersReducedMotion())
    return () => stage?.setTracking(false)
  }, [backend.live2dStage, settings.gaze])
  // T-7: a connection starts in the mode chosen in settings (the toggle on top still changes it during the call).
  useEffect(() => {
    if (!active || !backend.featurePort || modeAppliedFor.has(active.id)) return
    modeAppliedFor.add(active.id)
    backend.featurePort.setSettings({ advanced: settings.mode === 'advanced' })
  }, [active, backend.featurePort, settings.mode])
  // 「누르고 말하기」: browser speech recognition while the mic button or Space (T-8) is held; the sentence goes out
  // as a chat message (same API and credit rule). Same rule as the chat box: not while a reply is on its way.
  const pushToTalk = usePushToTalk({
    holdToTalk: settings.holdToTalk,
    windows: [typeof window === 'undefined' ? null : window, pip.window],
    userId: state.profile.userId,
    send: (text) => send(text),
    canListen: () => !sending && !speaking && !finishing && Boolean(active),
  })
  // The connection ending stops a press and drops what was being heard.
  const cancelTalk = pushToTalk.cancel
  useEffect(() => { if (finishing) cancelTalk() }, [finishing, cancelTalk])
  // The mouth moves exactly while a line is typing on screen: a chat reply (also while it streams in) or the event
  // bubble. v2 stages only; Cubism stages have no `setTalking`.
  const talking = speaking || bubbleTyping
  useEffect(() => {
    const stage = backend.live2dStage
    stage?.setTalking?.(talking)
    return () => stage?.setTalking?.(false)
  }, [backend.live2dStage, talking])
  const cue = useCallback((input: Parameters<typeof expressions.cue>[0]) => expressions.cue(input), [expressions])
  const navigateToRecord = useCallback((recordId: string, afterHangup = false) => {
    const target = `/connections/${recordId}`
    const reduced = prefersReducedMotion()
    const doc = document as ViewTransitionDocument
    if (afterHangup) {
      // STEP 04: the darkened call screen cross-fades into the record page, which then raises the card (STEP 05).
      const state = { hangup: true }
      if (reduced || typeof doc.startViewTransition !== 'function') {
        navigate(target, { replace: true, state })
        return
      }
      const root = document.documentElement
      root.dataset.viewTransition = 'hangup'
      // A transition update keeps React from flashing the lazy route's fallback; the callback waits for the new page.
      const transition = doc.startViewTransition(async () => {
        startTransition(() => { void navigate(target, { replace: true, state }) })
        await whenRendered('.connection-record-window')
      })
      void transition.finished.finally(() => { delete root.dataset.viewTransition })
      return
    }
    const stageEl = stageWrapRef.current?.querySelector<HTMLElement>('.connection-mate')
    if (reduced || typeof doc.startViewTransition !== 'function' || !stageEl) {
      navigate(target, { replace: true })
      return
    }
    stageEl.style.viewTransitionName = 'connection-stage-to-record'
    const transition = doc.startViewTransition(() => {
      navigate(target, { replace: true })
    })
    void transition.finished.finally(() => {
      stageEl.style.viewTransitionName = ''
    })
  }, [navigate])
  const tapMate = () => {
    if (!mate || finishing) return
    // Not while a reply is on its way, typing in the chat, or a line is typing in her bubble (it would be cut off).
    const reaction = tapper.tap(mate.id, sending || talking)
    if (!reaction) return
    const reduced = prefersReducedMotion()
    const stage = backend.live2dStage
    if (stage) {
      cue({ characterId: Number(mate.characterId), expression: { file: reaction.face }, event: 'TAP', stage: 'notice' })
      if (!reduced) stage.nudge?.()
    } else if (!reduced) {
      setStillBounce((value) => value + 1)
    }
    setSpeech((previous) => ({ id: previous.id + 1, at: Date.now(), text: reaction.line }))
  }
  // The stage no longer changes its layout on a click (user decision): a click on the mate herself is a tap.
  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element
    // The speech bubble (skips typing) and any control keep their own click.
    if (target.closest('button, a, input, textarea, select, .connection-speech-slot')) return
    const section = target.closest('.connection-mate')
    if (!section || !onMate(section.getBoundingClientRect(), event.clientX, event.clientY)) return
    tapMate()
  }
  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const section = (event.target as Element).closest('.connection-mate')
    const over = Boolean(section && !(event.target as Element).closest('button, a, .connection-speech-slot') && onMate(section.getBoundingClientRect(), event.clientX, event.clientY))
    event.currentTarget.toggleAttribute('data-over-mate', over)
  }
  const serverEnded = useCallback(() => {
    if (!mounted.current || !active || !state.profile.userId) return
    flushFocus()
    if (!backend.acknowledgeEndedSession(active.id, state.profile.userId)) return
    controller.stop()
    pip.close()
    navigateToRecord(active.id)
  }, [active, state.profile.userId, flushFocus, backend, controller, pip, navigateToRecord])
  const sync = useSessionSync({
    active, userId: state.profile.userId, observation, camera: !!camera, busy: sending || speaking, talk: settings.talk,
    // 「먼저 말 걸기」 (idle-talk.ts): quiet counts from the end of the last talk; the event line typing, the user's voice
    // and the hang-up also hold it.
    idleTalk: true,
    holdIdleTalk: bubbleTyping || finishing || (pushToTalk.snapshot.status !== 'idle' && pushToTalk.snapshot.status !== 'unsent'),
    onExpression: cue,
    onReaction: (result, event) => {
      const reply = result.characters?.find(value => String(value.characterId) === mate?.characterId)
      const content = reply?.content
      if (content) setSpeech(previous => ({ id: previous.id + 1, at: Date.now(), text: content }))
      if (reply?.characterId) cue({ characterId: reply.characterId, expression: reply.expression, event, stage: 'speech', text: reply.content })
    },
    // A server-side end during the hang-up is the same ending; the sequence already navigates.
    onEnded: () => { if (!hangup.current) serverEnded() },
  })
  const messages = state.messages.filter(message => message.characterId === mate?.characterId && /^\d+$/.test(message.sessionId))
  const lastText = messages.at(-1)?.text
  const latestReply = messages.findLast(message => message.sender === 'character')
  useEffect(scrollLatest, [messages.length, lastText, chatOpen, scrollLatest])
  useEffect(() => {
    if (video.current) { video.current.srcObject = camera; if (camera) void video.current.play().catch(() => {}) }
  }, [camera, active?.id])
  useEffect(() => {
    const input = () => { idle.current.input(Date.now()); attemptedIdleEnd.current = false }
    const surfaces = pip.window ? [window, pip.window] : [window]
    for (const surface of surfaces) for (const type of ['pointerdown', 'keydown', 'wheel'] as const) surface.addEventListener(type, input, { passive: true })
    return () => { for (const surface of surfaces) for (const type of ['pointerdown', 'keydown', 'wheel'] as const) surface.removeEventListener(type, input) }
  }, [pip.window])
  const finish = useCallback(async (confirmed = false) => {
    if (busy.current || !active) return
    busy.current = true
    setFinishing(true)
    setFinishError('')
    // The end request starts right away; the hang-up motion plays alongside it and never delays it.
    // An unknown presence baseline without confirmation is refused at once, so it gets no motion.
    const root = pageRef.current
    const playback = root && (confirmed || active.presenceKnown !== false) ? playHangup(root, prefersReducedMotion()) : null
    if (playback) {
      hangup.current = playback
      setEnding({ session: active, at: Date.now() })
      setLeaveOpen(false)
      void import('./ConnectionRecordPage')
    }
    let recorded = false
    // If the record is still on its way when the motion ends, say so instead of sitting on a dark screen.
    void playback?.finished.then(done => { if (done && !recorded && mounted.current) setEndingWait(true) })
    try {
      flushFocus()
      const record = await backend.finishSession({ acceptUnknownPresence: confirmed })
      recorded = true
      if (!mounted.current) return
      controller.stop()
      if (playback && !(await playback.finished)) return
      if (mounted.current) navigateToRecord(record.id, Boolean(playback))
    } catch (reason) {
      if (playback) {
        playback.cancel()
        hangup.current = null
        if (mounted.current) { setEnding(null); setEndingWait(false) }
      }
      if (!mounted.current) return
      if (reason instanceof ApiError && reason.code === 'CONNECTION_ENDED') serverEnded()
      else { setFinishError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.'); setLeaveOpen(true) }
    }
    finally { busy.current = false; if (mounted.current) setFinishing(false) }
  }, [active, backend, controller, flushFocus, navigateToRecord, setLeaveOpen, serverEnded])
  useEffect(() => {
    if (!active || finishing) return
    const presence = observation && performance.now() - observation.at <= 1500 ? observation.faceCount > 0 ? 'present' : 'absent' : 'unknown'
    const remaining = idle.current.remaining(now, !!camera, presence)
    if (remaining <= 0 && !attemptedIdleEnd.current) {
      attemptedIdleEnd.current = true
      void finish()
    }
  }, [now, camera, observation, active, finishing, finish])
  async function send(text: string, inputType: 'TEXT' | 'QUICK' = 'TEXT') {
    if (!mate || sending || speaking || finishing || !text.trim()) return false
    followMessages.current = true
    setSending(true)
    setError('')
    try {
      const result = await backend.sendMessage(mate.characterId, text, inputType)
      if (!mounted.current) return false
      if (result.characterId) cue({ characterId: result.characterId, expression: result.expression, event: 'MESSAGE', stage: 'speech', text: result.content })
      setDraft('')
      return true
    } catch (reason) {
      if (mounted.current) {
        if (reason instanceof ApiError && reason.code === 'CONNECTION_ENDED') serverEnded()
        else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
      }
      return false
    }
    finally { if (mounted.current) setSending(false) }
  }
  function toggleCamera() {
    if (camera) { flushFocus(); controller.stop('camera') }
    else if (!privacySeen) setPrivacyOpen(true)
    else void controller.request('camera')
  }
  function toggleFullscreen() {
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }
  if (!mate) return <NotFoundPage />
  if (!shown) {
    const heroSrc = mateHeroPortrait(mate.id, mate.image)
    return (
      <main id="main-content" tabIndex={-1} className="connection-entry focus:outline-none">
        <section className="connection-entry-window desktop-window desktop-window--active" aria-labelledby="connection-entry-title">
          <header className="desktop-window-titlebar mate-window-titlebar-static">
            <div className="desktop-window-title-left">
              <span className="desktop-mate-title">
                <span className="desktop-mate-dot" aria-hidden="true" />
                <span>{mate.name} · 연결 준비 중</span>
              </span>
            </div>
            <div className="desktop-window-title-right">
              <span className="desktop-mate-ai-badge">AI 캐릭터</span>
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </header>
          <div className="connection-entry-stage" style={{ background: CALL_STAGE_GRADIENT }}>
            {!bgFailed && (
              <img
                src={mateCallBackground(mate.id).portrait}
                alt=""
                aria-hidden="true"
                className="desktop-mate-bg-img"
                draggable={false}
                onError={() => setBgFailed(true)}
              />
            )}
            {heroSrc && (
              <div className="connection-entry-portrait">
                <img src={heroSrc} width={760} height={900} alt={mate.name} draggable={false} />
              </div>
            )}
          </div>
          <div className="connection-entry-body">
            <h1 id="connection-entry-title">{backend.activeSummary ? `${withParticle(mate.name, '과', '와')} 다시 연결할까요?` : mate.name}</h1>
            {backend.activeSummary && <p className="connection-entry-sub">하던 대화를 이어서 해요.</p>}
            <ConnectMateButton
              mate={mate}
              label={backend.activeSummary ? '다시 연결하기' : '연결하기'}
              errorPlacement="above"
            />
            <ButtonLink to="/" variant="ghost" size="sm">홈으로</ButtonLink>
          </div>
        </section>
      </main>
    )
  }

  const relation = backend.affinities[Number(mate.characterId)]
  // The affinity chip follows the affinity feature (off in production until the server sends stages).
  const showAffinity = resolveMateFeatures(import.meta.env.DEV, null).affinity
  const isAdvanced = Boolean(backend.betaSettings?.advanced)
  const canSwitchMode = Boolean(backend.featurePort)
  const creditInsufficient = Boolean(
    backend.wallet &&
    backend.betaSettings &&
    (backend.betaSettings.voice ? CREDIT_PRICING.voice : 0) +
      (backend.betaSettings.advanced ? CREDIT_PRICING.advanced : 0) >
      backend.wallet.attendance + backend.wallet.invitation,
  )
  const floatingErrors = [sync.error, devices.camera.error, pip.error].filter(Boolean)
  const leaveQuote = selectLeaveQuote(backend.mateDetails[mate.id], mate)
  const cameraBusy = devices.camera.status === 'requesting'
  const dockItems: GlassDockItem[] = [
    {
      key: 'microphone',
      label: pushToTalk.supported ? (pushToTalk.snapshot.status === 'listening' ? '듣는 중' : '누르고 말하기') : PUSH_TO_TALK_TEXT.unsupported,
      tooltip: pushToTalk.supported ? (pushToTalk.snapshot.status === 'listening' ? '듣는 중 · 떼면 보내요' : '누르고 말하기 · 스페이스') : PUSH_TO_TALK_TEXT.unsupported,
      icon: 'microphone',
      disabled: !pushToTalk.supported || finishing,
      listening: pushToTalk.snapshot.status === 'listening',
      onAction: () => {},
      onPressStart: () => pushToTalk.press('dock', window),
      onPressEnd: () => pushToTalk.release('dock'),
    },
    {
      key: 'camera',
      label: cameraBusy ? '카메라 연결 중' : camera ? '카메라 끄기' : '카메라 켜기',
      tooltip: cameraBusy ? '연결 중' : camera ? '카메라 끄기' : '카메라 켜기',
      icon: camera ? 'video' : 'videoOff',
      pressed: !!camera,
      device: true,
      disabled: cameraBusy,
      busy: cameraBusy,
      onAction: toggleCamera,
    },
    {
      key: 'chat',
      label: chatOpen ? '채팅 닫기' : '채팅 열기',
      tooltip: chatOpen ? '채팅 닫기' : '채팅 열기',
      icon: 'chat',
      pressed: chatOpen,
      expanded: chatOpen,
      shortcut: 'C',
      controls: 'connection-chat',
      onAction: () => setChatOpen(value => !value),
    },
    {
      key: 'pip',
      label: 'PIP로 띄우기',
      tooltip: 'PIP로 띄우기',
      icon: 'shrink',
      pressed: pip.status === 'open',
      disabled: pip.status === 'opening',
      busy: pip.status === 'opening',
      dividerBefore: true,
      secondary: true,
      onAction: () => { void pip.open(PIP_WINDOW_SIZE[settings.pipSize]) },
    },
    {
      key: 'fullscreen',
      label: isFullscreen ? '전체화면 종료' : '전체화면 전환',
      tooltip: isFullscreen ? '전체화면 종료' : '전체화면',
      icon: 'expand',
      pressed: isFullscreen,
      secondary: true,
      onAction: toggleFullscreen,
    },
    {
      key: 'settings',
      label: '설정',
      tooltip: '설정',
      icon: 'sliders',
      hasPopup: 'dialog',
      secondary: true,
      onAction: () => setSettingsOpen(true),
    },
    {
      key: 'leave',
      label: '연결 끊기',
      tooltip: '연결 끊기',
      icon: 'phoneOff',
      tone: 'danger',
      dividerBefore: true,
      disabled: finishing,
      busy: finishing,
      onAction: () => setLeaveOpen(true),
    },
  ]

  return (
    <main
      ref={pageRef}
      id="main-content"
      tabIndex={-1}
      className="connection-page focus:outline-none"
      data-hangup={ending ? '' : undefined}
    >
      {/* The call "screen": the hang-up switches it off like a TV, so the titlebar and stage collapse as one. */}
      <div className="connection-screen" inert={Boolean(ending)}>
      <header className="desktop-window-titlebar mate-window-titlebar-static connection-titlebar">
        {/* Left: the CAPSULE logo (not a link: leaving would end the call; 「연결 끊기」 is in the dock) | the mate. */}
        <div className="connection-titlebar-left">
          <span className="connection-titlebar-brand"><Brand /></span>
          <span className="connection-titlebar-divider" aria-hidden="true" />
          <span className="desktop-mate-dot" aria-hidden="true" title="연결 중" />
          <h1>{mate.name}<span className="sr-only"> · 연결 중</span></h1>
          <span className="desktop-mate-ai-badge">AI 캐릭터</span>
        </div>

        <div className="connection-titlebar-center">
          <div className="connection-mode-segment" role="group" aria-label="대화 모드">
            <button
              type="button"
              className="connection-mode-option"
              data-active={!isAdvanced || undefined}
              aria-pressed={!isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => backend.featurePort?.setSettings({ advanced: false })}
            >
              기본 · 크레딧 없음
            </button>
            <button
              type="button"
              className="connection-mode-option"
              data-active={isAdvanced || undefined}
              aria-pressed={isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => backend.featurePort?.setSettings({ advanced: true })}
            >
              고급 · 1턴 {CREDIT_PRICING.advanced}
            </button>
          </div>
        </div>

        <div className="connection-titlebar-right">
          <DevicePrivacyInfo label="연결 화면 안내" className="connection-titlebar-help">
            <ConnectionHelpNote />
          </DevicePrivacyInfo>
          {showAffinity && (
            <span className="connection-titlebar-chip connection-affinity-chip" title="친밀도">
              <Icon name="heart" size={13} />
              <span className="connection-chip-value">{relation?.stageName || '—'}</span>
              <span className="connection-affinity-steps" aria-hidden="true">
                {Array.from({ length: AFFINITY_STAGE_COUNT }, (_, index) => <span key={index} data-on={index < (relation?.stage ?? 0) || undefined} />)}
              </span>
              <span className="sr-only">친밀도 {relation?.stage ?? 0}단계</span>
            </span>
          )}
          {backend.wallet && (
            <span className="connection-titlebar-chip connection-credit-chip" title="오늘 남은 크레딧">
              <Icon name="coin" size={14} />
              <span className="connection-chip-caption">오늘 남은</span>
              <span className="connection-chip-value">{(backend.wallet.attendance + backend.wallet.invitation).toLocaleString('ko-KR')}</span>
            </span>
          )}
          <div ref={infoMenuRef} className="connection-titlebar-more-wrap">
            <button
              type="button"
              className="mate-menu-trigger connection-titlebar-more"
              aria-label="연결 정보 더보기"
              aria-haspopup="menu"
              aria-expanded={infoMenuOpen}
              onClick={() => setInfoMenuOpen(open => !open)}
            >
              <Icon name="more" size={16} />
            </button>
            {infoMenuOpen && (
              <div role="menu" aria-label="연결 정보" className="mate-menu-panel connection-titlebar-more-menu">
                {showAffinity && (
                  <div className="connection-titlebar-more-item">
                    <span>친밀도</span>
                    <strong>{relation?.stageName || '—'}</strong>
                  </div>
                )}
                {backend.wallet && (
                  <div className="connection-titlebar-more-item">
                    <span>오늘 남은 크레딧</span>
                    <strong>{(backend.wallet.attendance + backend.wallet.invitation).toLocaleString('ko-KR')}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* The call time at the right end (hang-up, PIP and full screen live in the dock). */}
          <time className="connection-timer" aria-label="연결 시간">
            <AnimatedClock value={clock(sessionStudySeconds(shown, ending?.at ?? now))} />
          </time>
        </div>
      </header>

      <div className="connection-content" data-chat={chatOpen || undefined}>
        <div ref={stageWrapRef} className="connection-stage-wrap">
          <div ref={stageRef} className="connection-stage" data-layout="mate" onClick={onStageClick} onPointerMove={onStagePointerMove} onPointerLeave={(event) => event.currentTarget.removeAttribute('data-over-mate')}>
            {/* 「말 걸기 빈도」 (= settings T-1, kept in sync): short labels; what each means in its tooltip and, for a
                moment after choosing, below. Only the choice is violet. */}
            <div className="connection-talk" role="radiogroup" aria-label="말 걸기 빈도">
              {TALK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.talk === option.value}
                  tabIndex={settings.talk === option.value ? 0 : -1}
                  title={option.description}
                  className="connection-talk-option"
                  onClick={() => chooseTalk(option.value)}
                  onKeyDown={(event) => {
                    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
                    if (!step) return
                    event.preventDefault()
                    const index = TALK_OPTIONS.findIndex((item) => item.value === settings.talk)
                    const next = TALK_OPTIONS[(index + step + TALK_OPTIONS.length) % TALK_OPTIONS.length]!
                    chooseTalk(next.value)
                    const group = event.currentTarget.parentElement
                    requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {talkNote && <p className="connection-talk-note" role="status">{talkNote}</p>}
            {/* The keyboard's way to tap the mate (shows on focus only). */}
            <button type="button" className="connection-mate-pet" onClick={tapMate}>{mate.name} 쓰다듬기</button>
            <section
              className="connection-mate"
              aria-label={mate.name}
              data-speaking={speaking || undefined}
              style={{ background: CALL_STAGE_GRADIENT }}
            >
              {!bgFailed && (
                <img
                  src={mateCallBackground(mate.id).landscape}
                  alt=""
                  aria-hidden="true"
                  className="connection-mate-bg-img"
                  draggable={false}
                  onError={() => setBgFailed(true)}
                />
              )}
              <div className="connection-mate-figure">
                {backend.live2dStage ? (
                  <>
                    {pip.window && <img key={stillBounce} data-bounce={stillBounce > 0 || undefined} src={matePortrait(mate.id, mate.image)} width={800} height={600} alt="" className="connection-mate-fallback-img" />}
                    <Live2DFigure stage={backend.live2dStage} />
                  </>
                ) : (
                  <img key={stillBounce} data-bounce={stillBounce > 0 || undefined} src={matePortrait(mate.id, mate.image)} width={800} height={600} alt="" className="connection-mate-fallback-img" />
                )}
              </div>
              {speech.text && (
                <div className="connection-speech-slot">
                  <CharacterSpeechBubble
                    key={speech.id}
                    name={mate.name}
                    text={speech.text}
                    expanded
                    variant="pill"
                    onTypingChange={setBubbleTyping}
                  />
                </div>
              )}
            </section>

            <section className="connection-self desktop-window" aria-label="내 화면">
              <div className="connection-self-titlebar">
                <span className="connection-self-title">나</span>
                <span
                  className="connection-self-camera-state"
                  data-camera-on={Boolean(camera) || undefined}
                  aria-hidden="true"
                >
                  <span className="connection-self-camera-dot" />
                  <Icon name="camera" size={12} />
                </span>
              </div>
              <div className="connection-self-body">
                <video ref={video} muted autoPlay playsInline hidden={!camera} aria-label="내 카메라 미리보기" />
                {!camera && (
                  <div className="connection-avatar">
                    {state.profile.profileImage ? (
                      <img src={state.profile.profileImage} alt="내 아바타" />
                    ) : (
                      <Icon name="user" size={32} />
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {(creditInsufficient || floatingErrors.length > 0) && (
            <div className="connection-floating-notices" aria-live="polite">
              {creditInsufficient && (
                <div className="connection-notice-card">
                  <FeedbackMessage tone="warning">크레딧이 부족해요. 기본 대화로 계속할 수 있어요.</FeedbackMessage>
                </div>
              )}
              {floatingErrors.map((message, index) => (
                <div key={`${index}:${message}`} className="connection-notice-card">
                  <FeedbackMessage tone="error">{message}</FeedbackMessage>
                </div>
              ))}
            </div>
          )}

          {/* 「누르고 말하기」: what is being heard, the sentence before it goes out, notices; above the dock. */}
          {(pushToTalk.snapshot.status !== 'idle' || pushToTalk.snapshot.notice || (pushToTalk.privacy && !pip.window)) && (
            <div className="connection-stt" data-status={pushToTalk.snapshot.status} role="status" aria-live="polite">
              {/* The first-use notice shows where the user is talking: here, or in the PIP window while it is open. */}
              {pushToTalk.privacy && !pip.window && <SttPrivacy onShown={pushToTalk.privacyShown} />}
              {pushToTalk.snapshot.status !== 'idle' && (
                <p className="connection-stt-text">
                  <span className="connection-stt-label">{STT_LABEL[pushToTalk.snapshot.status]}</span>
                  {pushToTalk.snapshot.text || (pushToTalk.snapshot.status === 'listening' ? '말해 보세요…' : '')}
                </p>
              )}
              {pushToTalk.snapshot.status === 'unsent' && (
                <p className="connection-stt-actions">
                  <button type="button" className="connection-stt-retry" onClick={pushToTalk.retry}>다시 보내기</button>
                  <button type="button" className="connection-stt-dismiss" onClick={pushToTalk.dismiss}>지우기</button>
                </p>
              )}
              {pushToTalk.snapshot.notice && (
                <p className="connection-stt-notice" data-tone={pushToTalk.snapshot.noticeTone}>{pushToTalk.snapshot.notice}</p>
              )}
            </div>
          )}

          <GlassDock
            className="connection-controls"
            ariaLabel="연결 컨트롤"
            containerRef={stageWrapRef}
            items={dockItems}
            moreLabel="추가 도구"
            moreMenuLabel="추가 연결 도구"
          />
        </div>

        {chatOpen && (
          <aside id="connection-chat" className="connection-chat desktop-window" aria-labelledby="connection-chat-title">
            <header className="desktop-window-titlebar mate-window-titlebar-static">
              <div className="desktop-window-title-left">
                <h2 id="connection-chat-title">{withParticle(mate.name, '과', '와')} 대화</h2>
              </div>
              <div className="desktop-window-title-right">
                <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)} aria-label="대화창 닫기" className="connection-chat-close">
                  <Icon name="close" size={16} />
                </Button>
              </div>
            </header>
            <div
              ref={messageList}
              className="connection-messages"
              role="log"
              aria-label={`${withParticle(mate.name, '과', '와')} 대화`}
              aria-live="polite"
              aria-relevant="additions"
              onScroll={() => {
                const node = messageList.current
                if (node) followMessages.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64
              }}
            >
              {messages.map(message => (
                <article key={message.id} data-sender={message.sender}>
                  <small>{message.sender === 'user' ? state.profile.name : mate.name}</small>
                  <p>
                    {message.sender === 'character' ? (
                      <TypingMessage
                        id={message.id}
                        text={message.text}
                        seen={seenMessages}
                        onProgress={scrollLatest}
                        onTypingChange={reportTyping}
                      />
                    ) : (
                      message.text
                    )}
                  </p>
                </article>
              ))}
              {sending && messages.at(-1)?.sender !== 'character' && <TypingIndicator name={mate.name} />}
            </div>
            {error && (
              <div className="connection-chat-error">
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
              </div>
            )}
            <ChatComposer name={mate.name} text={draft} onChange={setDraft} onSend={send} sendDisabled={sending || speaking || finishing} />
          </aside>
        )}
      </div>
      </div>

      {/* Hang-up stage (always mounted so the motion can start on the click's frame). */}
      <div className="connection-hangup" data-waiting={endingWait || undefined} aria-hidden={!ending}>
        <div className="connection-hangup-dim" />
        <div className="connection-hangup-crt" />
        {/* The handset turns from the call's purple to the end-call red as it is hung up. */}
        <div className="connection-hangup-handset">
          <img src={hangupHandset} width={480} height={480} alt="" decoding="async" draggable={false} />
          <img className="connection-hangup-handset-red" src={hangupHandsetRed} width={480} height={480} alt="" decoding="async" draggable={false} />
        </div>
        {/* Like a phone's call-ended screen: the label and the final call time. */}
        <p className="connection-hangup-ended" aria-hidden="true">
          <span className="connection-hangup-ended-dot" />
          <strong>통화 종료</strong>
          <time>{ending ? clock(sessionStudySeconds(ending.session, ending.at)) : ''}</time>
        </p>
        {ending && <p className="sr-only" role="status">연결을 끊었어요. 연결 기록으로 이동해요.</p>}
        <p className="connection-hangup-wait">{endingWait ? '연결 기록을 정리하고 있어요' : ''}</p>
      </div>

      {pip.window && (
        <ConnectionPip
          target={pip.window}
          mate={mate}
          stage={backend.live2dStage}
          onTapMate={tapMate}
          talk={{
            supported: pushToTalk.supported,
            listening: pushToTalk.snapshot.status === 'listening',
            text: pushToTalk.snapshot.status === 'idle' ? '' : pushToTalk.snapshot.text,
            notice: pushToTalk.snapshot.notice,
            disabled: finishing,
            start: () => pushToTalk.press('pip', pip.window),
            end: () => pushToTalk.release('pip'),
            privacy: pushToTalk.privacy,
            onPrivacyShown: pushToTalk.privacyShown,
            unsent: pushToTalk.snapshot.status === 'unsent',
            retry: pushToTalk.retry,
          }}
          speech={showPipSpeech ? (latestReply && (latestReply.createdAt ?? 0) >= speech.at ? latestReply.text : speech.text) : undefined}
          onReturn={() => { window.focus(); pip.close() }}
        />
      )}
      {settingsOpen && <AccountSettingsDialog initialView="settings" onClose={() => setSettingsOpen(false)} />}

      <Dialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="카메라 사용 안내">
        <p className="text-muted">카메라를 켜면 자리 비움·복귀에 메이트가 반응해요. 영상은 이 기기 안에서만 확인하고 저장하거나 보내지 않아요.</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => { setPrivacySeen(true); setPrivacyOpen(false); void controller.request('camera') }}>카메라 켜기</Button>
          <Button variant="secondary" onClick={() => setPrivacyOpen(false)}>카메라 없이 하기</Button>
        </div>
      </Dialog>

      <Dialog
        open={leaveOpen}
        onClose={() => { if (!finishing) setLeaveOpen(false) }}
        dismissible={!finishing}
        showHeader={false}
        title={`${withParticle(mate.name, '과', '와')}의 연결을 끊을까요?`}
        className="mate-reset-dialog mate-reset-dialog--desktop connection-leave-dialog"
      >
        <header className="desktop-window-titlebar mate-window-titlebar-static">
          <div className="desktop-window-title-left">연결 끊기</div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls">
              <button
                type="button"
                className="desktop-window-dot desktop-window-dot--close"
                aria-label="닫기"
                disabled={finishing}
                onClick={() => setLeaveOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
              <span className="desktop-window-dot" aria-hidden="true" />
              <span className="desktop-window-dot" aria-hidden="true" />
            </div>
          </div>
        </header>
        <div className="mate-reset-dialog-body">
          <h2 className="mate-reset-dialog-heading">{withParticle(mate.name, '과', '와')}의 연결을 끊을까요?</h2>
          {leaveQuote && (
            <div className="connection-leave-quote">
              <span className="connection-leave-quote-name">{mate.name}</span>
              <p>{leaveQuote}</p>
            </div>
          )}
          {finishError && <FeedbackMessage tone="error" className="mt-4">{finishError}</FeedbackMessage>}
          {shown.presenceKnown === false && (
            <p className="mt-3 text-muted">
              이전 자리 지킴 시간을 불러오지 못했어요. 지금 끝내면 이어서 연결한 동안의 자리 지킴만 기록돼요.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={finishing}
              onClick={() => setLeaveOpen(false)}
              data-dialog-initial-focus
            >
              계속하기
            </Button>
            <Button
              variant="danger-solid"
              loading={finishing}
              onClick={() => { void finish(true) }}
            >
              연결 끊기
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  )
}
