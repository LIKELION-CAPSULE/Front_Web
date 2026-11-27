import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useSessionSync } from '@/features/backend/use-session-sync'
import { StageUpLine, StageUpNotice } from '@/features/mates/components/StageUpNotice'
import type { EndType, StageUp } from '@/shared/api/types'
import { useMinorLimit } from '@/features/mates/minor-limit'
import { ConnectionNotice } from '@/features/mates/components/ConnectionNotice'
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
import { CALL_STAGE_GRADIENT, mateAvatar, mateCallBackground, mateHeroPortrait, matePortrait } from '@/features/mates/artwork'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useExpressionDirector } from '@/features/live2d/use-live2d'
import { useNow } from '@/features/session/use-now'
import { ChatComposer } from '@/features/session/components/ChatComposer'
import { TypingMessage } from '@/features/session/components/TypingMessage'
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
import { startModeToApply } from '@/features/mates/connection-start-mode'
import { withConnectionCharacter } from '@/features/mates/connected-mate'
import { mateVoiceOn, mateVoicePatch, PIP_WINDOW_SIZE, QUICK_REPLIES, TALK_OPTIONS, voiceIntroKey } from '@/features/mates/connection-preferences'
import { usePushToTalk } from '@/features/mates/use-push-to-talk'
import { PUSH_TO_TALK_TEXT } from '@/features/mates/push-to-talk'
import { AFFINITY_STAGE_COUNT, resolveMateFeatures } from '@/features/mates/mate-features'
import { normalizeAffinityStage } from '@/features/mates/affinity-stages'
import { DevicePrivacyInfo } from '@/features/media/components/DevicePrivacyInfo'
import { Brand } from '@/shared/ui/Brand'
import { MateTap, onMate } from '@/features/mates/mate-tap'
import { playHangup, whenRendered, type HangupPlayback } from '@/features/mates/hangup-sequence'
import { takePickup } from '@/features/mates/pickup-sequence'
import { useChatHistory } from '@/features/mates/use-chat-history'
import { ChatHistoryStatus } from '@/features/mates/components/ChatHistoryStatus'
import { ChatLogGroups } from '@/features/mates/components/ChatLogGroups'
import { CallDialogueBox } from '@/features/mates/components/CallDialogueBox'
import { CallMateTitle } from '@/features/mates/components/CallMateTitle'
import { callWorld } from '@/features/mates/call-world'
import { callIntimacy, recallCallIntimacy, rememberCallIntimacy } from '@/features/mates/call-intimacy'
import { pickStageLine } from '@/features/mates/call-dialogue'
import { unreadArrivals } from '@/features/mates/chat-groups'
import { PixelImage, PixelRoofStrip } from '@/shared/ui/pixel/PixelFrame'
import { ReplyActions, ReportedReply } from '@/features/mates/components/ReplyActions'
import { CreditShortNotice } from '@/features/mates/components/CreditShortNotice'
import { CREDIT_NOTICE_COPY, creditShortage, shouldNoteVoiceFallback } from '@/features/mates/credit-notice'
import { useVoiceReply } from '@/features/mates/use-voice-reply'
import type { VoiceTurn } from '@/features/mates/voice-player'
import { voiceMayPlayNow, voiceRequested, voiceStopsForListening, voiceStopsWhenHidden } from '@/features/mates/voice-reply'
import hangupHandset from '@/assets/connection/hangup-handset-3d.webp'
import hangupHandsetRed from '@/assets/connection/hangup-handset-3d-red.webp'
import { useCreditDisplay } from '@/features/attendance/use-credit-display'

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
      <p>크레딧은 기본 대화 0, 고급 대화 한 턴에 {CREDIT_PRICING.advanced}이에요. 메이트 음성을 켜 두면 음성으로 답한 턴마다 {CREDIT_PRICING.voice}이 더 들어요. 크레딧이 모자라면 글로만 답해요.</p>
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

/** The chat's close button: a still X (the X does not turn, 2026-11-28). */
function StillClose() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="connection-chat-close-glyph">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** A stage-up of this call, logged as a chat note where it arrived (StageUpLine). */
type StageNote = { id: string; at: number; stage: number; stageName: string; unlocked?: StageUp['unlocked'] }

/** Connections whose starting mode (T-7) was applied in this page load (a reload or remount keeps the call's mode). */
/** 메이트 음성 when this browser could not prepare the audio (the dock's tooltip and the call's notice). */
const VOICE_UNAVAILABLE = '이 브라우저에서는 메이트 음성을 재생할 수 없어요'
const modeAppliedFor = new Set<string>()

/** A chat line's top within the chat list's visible area (the older-page anchor). */
const lineTop = (node: HTMLElement, article: HTMLElement) => article.getBoundingClientRect().top - node.getBoundingClientRect().top

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ConnectionPage() {
  const { mateId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const backend = useBackend()
  const creditDisplay = useCreditDisplay()
  const { showPipSpeech, settings, updateSettings, modeConfirmed = true } = useConnectionPreferences()
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
  // The connection belongs here when it was matched to this launch mate (DemoProvider: by id, else by server name).
  const active = state.activeSession?.mateId === mateId ? state.activeSession : null
  // While the hang-up plays, the ended session keeps the call on screen: /end clears `activeSession` on success.
  const [ending, setEnding] = useState<{ session: NonNullable<typeof active>; at: number } | null>(null)
  const [endingWait, setEndingWait] = useState(false)
  const shown = active ?? ending?.session ?? null
  // With the connection's own server mate id (the other entry of a persona listed twice): messages go to that mate.
  const mate = withConnectionCharacter(availableMates(backend.home).find(value => value.id === mateId), shown)
  const pageRef = useRef<HTMLElement>(null)
  // Arriving from "공부 시작하기": the pickup overlay is still on screen; open the call screen from its line of light
  // before the first paint (the TV switching on), then let the overlay go.
  const callShown = Boolean(shown)
  useLayoutEffect(() => {
    if (callShown) takePickup()?.handoff(pageRef.current)
  }, [callShown])
  const hangup = useRef<HangupPlayback | null>(null)
  useEffect(() => () => { hangup.current?.cancel(); hangup.current = null }, [])
  const now = useNow()
  const [chatOpen, setChatOpenState] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 960 : true))
  /** 「새 메시지 ↓」's count (below); opening or closing the chat clears it. */
  const [unread, setUnread] = useState(0)
  const setChatOpen = (next: boolean | ((open: boolean) => boolean)) => {
    setChatOpenState(next)
    setUnread(0)
  }
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
  /** The dialogue box is typing a line (CallDialogueBox: on while letters appear, off when a page is shown or it goes). */
  const [lineTyping, setLineTyping] = useState(false)
  /** The dialogue box's line that closed (timed out, turned past, or the user sent a line): it does not come back. */
  const [lineDone, setLineDone] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacySeen, setPrivacySeen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bgFailed, setBgFailed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  )
  const pip = useDocumentPip()
  // The mate's voice (T-2…T-4): replies and reaction lines ask for it while 「메이트 음성」 is on — only once the user
  // turned it on (settings or the dock's button, one value: `mateVoiceOn`); never from the service tour (no credits
  // there). The volume is this browser's; the speed is the server's TTS.
  const voice = useVoiceReply({ volume: settings.volume, windows: [typeof window === 'undefined' ? null : window, pip.window] })
  const voicePlaying = voice.status === 'playing'
  const voiceOn = mateVoiceOn(settings)
  // Asked for (and paid) only once this browser really prepared the audio (context and graph made: use-voice-reply.ts).
  const voiceReady = voice.availability === 'ready'
  const voiceUnavailable = voice.availability === 'unavailable'
  const ttsWanted = voiceRequested({ voiceEnabled: voiceOn, practice: new URLSearchParams(location.search).has('tour'), playable: voiceReady })
  // Turned off (here, in the settings, or on another device's copy): the voice stops at once, and a voice asked for
  // before (a reaction line on its way) never plays.
  useEffect(() => { if (!voiceOn) voice.player.cut() }, [voiceOn, voice.player])
  /** The first time 메이트 음성 is turned on here: a short note of what it does and costs (once per account and browser). */
  const [voiceIntro, setVoiceIntro] = useState(false)
  useEffect(() => {
    if (!voiceIntro) return
    const timer = setTimeout(() => setVoiceIntro(false), 4000)
    return () => clearTimeout(timer)
  }, [voiceIntro])
  const toggleVoice = () => {
    const on = !voiceOn
    updateSettings(mateVoicePatch(on))
    if (!on) { setVoiceIntro(false); return }
    const userId = state.profile.userId
    let seen = false
    try { seen = Boolean(userId && localStorage.getItem(voiceIntroKey(userId)) === '1') } catch { /* Show it this time. */ }
    if (seen) return
    try { if (userId) localStorage.setItem(voiceIntroKey(userId), '1') } catch { /* Shown once in this page then. */ }
    setVoiceIntro(true)
  }
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
        setChatOpenState(value => !value)
        setUnread(0)
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
  /** Lines already here when the page opened (a reload): the dialogue box never replays them. */
  const [openingIds] = useState(() => new Set(state.messages.map(message => message.id)))
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
  // T-7: a connection starts in its start / resume response's mode; the settings' mode replaces it once confirmed (the
  // server copy was read, or the user changed it), never from an unconfirmed browser cache, and never after the toggle
  // on top was used (connection-start-mode.ts).
  useEffect(() => {
    const mode = startModeToApply({ connectionId: active?.id, applied: modeAppliedFor, confirmed: modeConfirmed, mode: settings.mode })
    if (!active || !mode) return
    modeAppliedFor.add(active.id)
    backend.setConnectionMode(mode)
  }, [active, backend, settings.mode, modeConfirmed])
  /** The toggle on top: the user's choice for this connection, kept over a settings read that arrives later. */
  const chooseMode = (mode: 'basic' | 'advanced') => {
    if (active) modeAppliedFor.add(active.id)
    backend.setConnectionMode(mode)
  }
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
  // The mouth moves exactly while a line is typing on screen: a chat reply (also while it streams in) or the dialogue
  // box. v2 stages only; Cubism stages have no `setTalking`. While her voice plays, the voice moves the mouth
  // instead (its level, every frame; Cubism and v2), so the typing motion steps aside.
  const talking = speaking || lineTyping
  useEffect(() => {
    const stage = backend.live2dStage
    stage?.setTalking?.(talking && !voicePlaying)
    return () => stage?.setTalking?.(false)
  }, [backend.live2dStage, talking, voicePlaying])
  useEffect(() => {
    const stage = backend.live2dStage
    // Reduced motion: no talking mouth (as with typing).
    stage?.setMouthSource?.(prefersReducedMotion() ? null : () => voice.player.level())
    return () => stage?.setMouthSource?.(null)
  }, [backend.live2dStage, voice.player])
  // The voice stops when the user starts talking (누르고 말하기), when the call ends or is being hung up, and when the
  // tab goes out of sight with no PiP window (with PiP the call goes on there, and so does the voice).
  const listening = voiceStopsForListening(pushToTalk.snapshot.status)
  useEffect(() => { if (listening) voice.player.cut() }, [listening, voice.player])
  const callLive = Boolean(active) && !finishing && !ending
  const callLiveRef = useRef(callLive)
  useLayoutEffect(() => { callLiveRef.current = callLive }, [callLive])
  useEffect(() => { if (!callLive) voice.player.cut() }, [callLive, voice.player])
  const pipWindow = pip.window
  /** What a voice that arrives later (a reaction line) checks right before it plays (voice-reply.ts `voiceMayPlayNow`). */
  const voiceGate = useRef({ voiceOn, listening, pipWindow })
  useLayoutEffect(() => { voiceGate.current = { voiceOn, listening, pipWindow } }, [voiceOn, listening, pipWindow])
  useEffect(() => {
    const onVisibility = () => {
      if (voiceStopsWhenHidden({ hidden: document.hidden, pipOpen: Boolean(pipWindow && !pipWindow.closed) })) voice.player.cut()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pipWindow, voice.player])
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
    // The dialogue box (shows / turns its page) and any control keep their own click.
    if (target.closest('button, a, input, textarea, select, .call-dialogue-slot')) return
    const section = target.closest('.connection-mate')
    if (!section || !onMate(section.getBoundingClientRect(), event.clientX, event.clientY)) return
    tapMate()
  }
  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const section = (event.target as Element).closest('.connection-mate')
    const over = Boolean(section && !(event.target as Element).closest('button, a, .call-dialogue-slot') && onMate(section.getBoundingClientRect(), event.clientX, event.clientY))
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
    // Her voice still playing counts as talking: a reaction line waits for it instead of cutting it off.
    active, userId: state.profile.userId, observation, camera: !!camera, busy: sending || speaking || voicePlaying, talk: settings.talk, tts: ttsWanted,
    voiceTicket: () => voice.player.ticket(),
    // 「먼저 말 걸기」 (idle-talk.ts): quiet counts from the end of the last talk; the event line typing, the user's voice
    // and the hang-up also hold it.
    idleTalk: true,
    holdIdleTalk: lineTyping || finishing || (pushToTalk.snapshot.status !== 'idle' && pushToTalk.snapshot.status !== 'unsent'),
    onExpression: cue,
    onReaction: (result, event, voiceTicket) => {
      const reply = result.characters?.find(value => String(value.characterId) === mate?.characterId)
      const content = reply?.content
      if (content) setSpeech(previous => ({ id: previous.id + 1, at: Date.now(), text: content }))
      // 19 `audioBase64`: the line's voice (asked with `tts`, made when the setting is on and credits cover it). It came
      // seconds after it was asked for: it plays only if the call still wants a voice now, and is dropped when the voice
      // was stopped since (its ticket is from before that).
      const gate = voiceGate.current
      if (content && reply?.audioBase64 && voiceMayPlayNow({
        voiceOn: gate.voiceOn, listening: gate.listening, callLive: callLiveRef.current,
        hidden: document.hidden, pipOpen: Boolean(gate.pipWindow && !gate.pipWindow.closed),
      })) voice.player.play(reply.audioBase64, voiceTicket)
      if (reply?.characterId) cue({ characterId: reply.characterId, expression: reply.expression, event, stage: 'speech', text: reply.content })
    },
    // A server-side end during the hang-up is the same ending; the sequence already navigates.
    onEnded: () => { if (!hangup.current) serverEnded() },
  })
  const localMessages = state.messages.filter(message => message.characterId === mate?.characterId && /^\d+$/.test(message.sessionId))
  // The dialogue box (C1 「대사창」): her newest line of this call — a reply (typing in as it streams) or an event line
  // (반응·먼저 말 걸기·탭) — until it closes; nothing while hanging up. Event lines are not in the chat log, so the box
  // has them read; a reply only while the chat (the log) is closed, once it is complete.
  const liveReply = active ? localMessages.findLast(message => message.sender === 'character' && message.sessionId === active.id && !openingIds.has(message.id)) : undefined
  const stageLine = ending ? null : pickStageLine([
    liveReply ? { key: liveReply.id, text: liveReply.text, at: liveReply.createdAt ?? 0 } : null,
    speech.text ? { key: `event:${speech.id}`, text: speech.text, at: speech.at } : null,
  ], lineDone)
  const stageLineRead = !stageLine ? '' : stageLine.key !== liveReply?.id ? stageLine.text : !chatOpen && liveReply.delivery !== 'pending' ? stageLine.text : ''
  // 32: the server's history in the chat; the running connection's lines stay this browser's (use-chat-history.ts).
  const chat = useChatHistory({
    userId: state.profile.userId, characterId: mate?.characterId, open: chatOpen && Boolean(shown), local: localMessages, activeConnectionId: active?.id ?? null,
    hasConversation: mate ? backend.mateDetails[mate.id]?.hasConversation : undefined,
  })
  const messages = chat.messages
  // 21 `stageUp` arriving during this call: one chat note per stage, at the time it came (the log shows it in order).
  const [stageNotes, setStageNotes] = useState<StageNote[]>([])
  const reachedNow = active && sync.stageUp ? normalizeAffinityStage(sync.stageUp.stage, sync.stageUp.stageName) : null
  const reachedId = active && reachedNow ? `stage:${active.id}:${reachedNow.stage}` : null
  if (reachedId && reachedNow && !stageNotes.some(note => note.id === reachedId)) {
    setStageNotes([...stageNotes, { id: reachedId, at: now, stage: reachedNow.stage, stageName: reachedNow.stageName, unlocked: sync.stageUp?.unlocked }])
  }
  const callNotes = active ? stageNotes.filter(note => note.id.startsWith(`stage:${active.id}:`)) : []
  // The titlebar's intimacy chip (친밀도 1–5, call-intimacy.ts): this connection's 16 `relation`, raised by a 21
  // `stageUp` at once (the same stage as the log's line and the stage's card). 20 / 28 `affinity` (호감도) is not used.
  // 17 resume has no relation: the stage this tab last showed for the connection (session storage) keeps the chip.
  const visuals = backend.visuals
  const startRelation = active && visuals && 'relation' in visuals && String(visuals.connectionId) === active.id ? visuals.relation : null
  const liveIntimacy = active ? callIntimacy(startRelation, sync.stageUp) : null
  const relation = active ? callIntimacy(liveIntimacy, recallCallIntimacy(active.id)) : null
  const relationStage = relation?.stage ?? 0
  const relationName = relation?.stageName
  const activeId = active?.id
  useEffect(() => {
    if (activeId && relationStage && relationName) rememberCallIntimacy(activeId, { stage: relationStage, stageName: relationName })
  }, [activeId, relationStage, relationName])
  /**
   * Reached the top of the chat: the older page. The first line in view stays where it was when the page lands (lines
   * can land above it and, out of order, below it). Lines are found by `article[data-message-id]` (ChatLogGroups puts
   * them in runs); the offset is measured against the list's own top.
   */
  const olderAnchor = useRef<{ id: string; offset: number } | null>(null)
  const loadOlderMessages = async () => {
    const node = messageList.current
    if (!node || olderAnchor.current) return
    const article = [...node.querySelectorAll<HTMLElement>('article[data-message-id]')].find(value => lineTop(node, value) + value.offsetHeight > 0)
    const id = article?.dataset.messageId
    if (article && id) olderAnchor.current = { id, offset: lineTop(node, article) }
    await chat.loadOlder()
    // The page lands in a render after this; the layout effect below uses the anchor, this frame drops a leftover.
    requestAnimationFrame(() => { olderAnchor.current = null })
  }
  const firstMessageId = messages[0]?.id
  useLayoutEffect(() => {
    const node = messageList.current, anchor = olderAnchor.current
    if (!node || !anchor) return
    olderAnchor.current = null
    const article = [...node.querySelectorAll<HTMLElement>('article[data-message-id]')].find(value => value.dataset.messageId === anchor.id)
    if (article) node.scrollTop += lineTop(node, article) - anchor.offset
  }, [firstMessageId]) // only when lines land above
  /** 「새 메시지 ↓」: her lines that arrived while the chat was scrolled up (chat-groups.ts `unreadArrivals`). */
  const lastMessageId = messages.at(-1)?.id
  const seenLastId = useRef(lastMessageId)
  useEffect(() => {
    const previous = seenLastId.current
    seenLastId.current = lastMessageId
    const arrived = chatOpen ? unreadArrivals(messages, previous, followMessages.current) : 0
    if (arrived) setUnread(count => count + arrived)
  }, [lastMessageId]) // eslint-disable-line react-hooks/exhaustive-deps -- only when a line lands at the end
  const jumpToLatest = () => {
    const node = messageList.current
    followMessages.current = true
    setUnread(0)
    node?.scrollTo({ top: node.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
  // 고급 모드 short of credits (409 CREDIT_INSUFFICIENT): the line that did not go, to send again in 기본 모드.
  const [creditShort, setCreditShort] = useState<{ text: string; inputType: 'TEXT' | 'QUICK'; credits: number | null } | null>(null)
  const [voiceNote, setVoiceNote] = useState<'none' | 'shown' | 'done'>('none')
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
  const finish = useCallback(async (confirmed = false, endType: EndType = 'NORMAL') => {
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
      const record = await backend.finishSession({ acceptUnknownPresence: confirmed, endType })
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
      void finish(false, 'AUTO_AWAY')
    }
  }, [now, camera, observation, active, finishing, finish])
  useMinorLimit({ connectionId: active?.id ?? null, deadline: sync.minorDeadline, now, busy: finishing || Boolean(ending), endConnection: () => void finish(false, 'MINOR_LIMIT') })
  async function send(text: string, inputType: 'TEXT' | 'QUICK' = 'TEXT') {
    if (!mate || sending || speaking || finishing || !text.trim()) return false
    followMessages.current = true
    setUnread(0)
    // Her line on the stage gives way to 「답장 준비 중」 (the dialogue box's waiting state).
    if (stageLine) setLineDone(stageLine.key)
    setSending(true)
    setError('')
    // A new reply is on its way: the voice before it stops, and this reply's voice (if asked) starts as it arrives.
    const tts = ttsWanted
    let turn: VoiceTurn | null = null
    if (tts) turn = voice.player.begin()
    else voice.player.stop()
    try {
      const result = await backend.sendMessage(mate.characterId, text, inputType, {
        tts,
        onAudio: audio => turn?.push(audio),
        onAudioEnd: end => turn?.end(end),
        onClose: () => turn?.end(null),
      })
      if (!mounted.current) return false
      setCreditShort(null)
      // Asked for voice but it came as text (credits short): said once.
      if (shouldNoteVoiceFallback({ requestedVoice: tts, voice: result.voice, noted: voiceNote !== 'none' })) setVoiceNote('shown')
      if (result.characterId) cue({ characterId: result.characterId, expression: result.expression, event: 'MESSAGE', stage: 'speech', text: result.content })
      // The box empties when a typed line goes (sendTyped); a line sent another way (누르고 말하기, a quick reply, the
      // credit notice's retry) clears it only if the box still holds that very line.
      setDraft(current => (current === text ? '' : current))
      return true
    } catch (reason) {
      if (mounted.current) {
        const short = creditShortage(reason)
        if (reason instanceof ApiError && reason.code === 'CONNECTION_ENDED') serverEnded()
        else if (short) setCreditShort({ text, inputType, credits: short.credits })
        else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
      }
      return false
    }
    finally { if (mounted.current) setSending(false) }
  }
  /** The chat box's send: the box empties at once (typing goes on while her reply is on its way) and gets the line back if it did not go. */
  async function sendTyped(text: string) {
    setDraft('')
    const sent = await send(text)
    if (!sent && mounted.current) setDraft(current => current || text)
    return sent
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

  // The affinity chip follows the affinity feature; with no server stage it shows 「—」 and no lit steps.
  const mateFeatures = resolveMateFeatures(import.meta.env.DEV, null)
  const showAffinity = mateFeatures.affinity
  const mateFace = mateAvatar(mate.id, mate.image)
  // The chat head's status: the call timer's minutes, or 「입력 중」 while her reply is on its way or typing in.
  const callMinutes = Math.floor(sessionStudySeconds(shown, ending?.at ?? now) / 60)
  const replyOnItsWay = (sending || speaking) && !ending
  // The empty chat: nothing said and nothing on its way, once the first read is done (or failed: the status says so).
  const chatEmpty = messages.length === 0 && !sending && !chat.room.failed && !(chat.room.loading.latest && !chat.room.loaded)
  const isAdvanced = backend.connectionMode === 'advanced'
  const canSwitchMode = !finishing
  const credits = creditDisplay.value
  const creditInsufficient = Boolean(
    backend.wallet &&
    backend.betaSettings &&
    (backend.betaSettings.voice ? CREDIT_PRICING.voice : 0) +
      (isAdvanced ? CREDIT_PRICING.advanced : 0) >
      backend.wallet.attendance + backend.wallet.invitation,
  )
  const floatingErrors = [sync.error, devices.camera.error, pip.error].filter(Boolean)
  // Her reply came as text because the credits ran short for 메이트 음성: over the composer, or among the stage's
  // notices while the chat is closed (the voice is used most with the chat closed).
  const voiceFallbackNote = (
    <p className="voice-fallback-note" role="status" onAnimationEnd={(event) => { if (event.target === event.currentTarget) setVoiceNote('done') }}>
      <Icon name="headphones" size={14} />
      <span>{CREDIT_NOTICE_COPY.voiceFallback}</span>
    </p>
  )
  const leaveQuote = selectLeaveQuote(backend.mateDetails[mate.id], mate)
  const cameraBusy = devices.camera.status === 'requesting'
  // Grouped (GlassDock `group`): 대화 (누르고 말하기 · 채팅 · 메이트 음성) | 기기 (카메라) | 화면 (PIP · 전체화면 · 설정) | 끊기.
  // The dock's 누르고 말하기 stays next to the composer's: with the chat closed it is the only one on screen.
  const dockItems: GlassDockItem[] = [
    {
      group: '대화',
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
      group: '대화',
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
      // 「메이트 음성」 (T-2, the same value as the settings switch): her voice on replies, 20 credits a reply.
      group: '대화',
      key: 'voice',
      label: voiceOn ? '메이트 음성 끄기' : '메이트 음성 켜기',
      tooltip: voiceUnavailable ? VOICE_UNAVAILABLE : voiceOn ? `메이트 음성 끄기 · 답장마다 ${CREDIT_PRICING.voice} 크레딧` : '메이트 음성 켜기',
      icon: 'headphones',
      pressed: voiceOn,
      disabled: voiceUnavailable || finishing,
      onAction: toggleVoice,
    },
    {
      group: '기기',
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
      // Picture-in-picture artwork (a small window over a large one), not 「minimize」, which reads as 「exit full screen」.
      // While the window is open the button brings it forward (DocumentPip.open focuses it).
      group: '화면',
      key: 'pip',
      label: pip.status === 'open' ? 'PIP 창으로 가기' : 'PIP로 띄우기',
      tooltip: pip.status === 'open' ? 'PIP 창으로 가기' : 'PIP로 띄우기 · 작은 창으로 곁에 두기',
      icon: 'pip',
      pressed: pip.status === 'open',
      disabled: pip.status === 'opening',
      busy: pip.status === 'opening',
      secondary: true,
      onAction: () => { void pip.open(PIP_WINDOW_SIZE[settings.pipSize]) },
    },
    {
      group: '화면',
      key: 'fullscreen',
      label: isFullscreen ? '전체화면 종료' : '전체화면 전환',
      tooltip: isFullscreen ? '전체화면 종료' : '전체화면',
      icon: 'expand',
      pressed: isFullscreen,
      secondary: true,
      onAction: toggleFullscreen,
    },
    {
      group: '화면',
      key: 'settings',
      label: '설정',
      tooltip: '설정',
      icon: 'sliders',
      hasPopup: 'dialog',
      secondary: true,
      onAction: () => setSettingsOpen(true),
    },
    {
      group: '끊기',
      key: 'leave',
      label: '연결 끊기',
      tooltip: '연결 끊기',
      icon: 'phoneOff',
      tone: 'danger',
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
      <ConnectionNotice />
      {/* The call "screen": the hang-up switches it off like a TV, so the titlebar and stage collapse as one. */}
      <div className="connection-screen" inert={Boolean(ending)}>
      <header className="desktop-window-titlebar mate-window-titlebar-static connection-titlebar">
        {/* Left: the CAPSULE logo (not a link: leaving would end the call; 「연결 끊기」 is in the dock) | the mate. */}
        <div className="connection-titlebar-left">
          <span className="connection-titlebar-brand"><Brand /></span>
          <span className="connection-titlebar-divider" aria-hidden="true" />
          {/* Her name, a short relation line and the world the call is in (when it is known: call-world.ts). */}
          <CallMateTitle name={mate.name} tag={mate.callTag} world={callWorld()} dotTitle="연결 중" />
        </div>

        {/* The info bar, all open (no 「⋯」, user decision 2026-11-27): ? | 친밀도 · 대화 모드 · 남은 크레딧 | 연결 시간.
            Narrow windows (≤ 1100px) shorten the chips to their icons (the full words stay in the tooltip and for screen
            readers); the mode is always shown. */}
        <div className="connection-titlebar-right">
          <DevicePrivacyInfo label="연결 화면 안내" className="connection-titlebar-help">
            <ConnectionHelpNote />
          </DevicePrivacyInfo>
          {showAffinity && (
            <span className="connection-titlebar-chip connection-affinity-chip" title={`친밀도 · ${relation?.stageName || '—'}`}>
              <Icon name="heart" size={13} />
              <span className="connection-chip-value connection-chip-long">{relation?.stageName || '—'}</span>
              <span className="connection-affinity-steps" aria-hidden="true">
                {Array.from({ length: AFFINITY_STAGE_COUNT }, (_, index) => <span key={index} data-on={index < (relation?.stage ?? 0) || undefined} />)}
              </span>
              <span className="sr-only">친밀도 {relation?.stage ?? 0}단계</span>
            </span>
          )}
          <div className="connection-mode-segment" role="group" aria-label="대화 모드">
            <button
              type="button"
              className="connection-mode-option"
              data-active={!isAdvanced || undefined}
              aria-pressed={!isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => chooseMode('basic')}
              // The mode itself is free; her voice (the dock's button) is counted apart, so say so while it is on.
              title={voiceOn ? `기본 모드는 크레딧 없이 대화해요. 메이트 음성은 답장마다 ${CREDIT_PRICING.voice} 크레딧이 따로 들어요` : '기본 모드 · 크레딧 없음'}
            >
              <span>기본<span className="connection-mode-detail"> · 크레딧 없음</span></span>
            </button>
            <button
              type="button"
              className="connection-mode-option"
              data-active={isAdvanced || undefined}
              aria-pressed={isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => chooseMode('advanced')}
              title={`고급 모드 · 1턴에 ${CREDIT_PRICING.advanced} 크레딧`}
            >
              <span>고급<span className="connection-mode-detail"> · 1턴 {CREDIT_PRICING.advanced}</span></span>
            </button>
          </div>
          {/* 「남은 크레딧」: the whole balance that can be spent now (server `todayRemaining`; use-credit-display.ts). */}
          {credits !== null && (
            <span className="connection-titlebar-chip connection-credit-chip" title={`남은 크레딧 · ${credits.toLocaleString('ko-KR')}`}>
              <Icon name="coin" size={14} className="credit-coin" />
              <span className="connection-chip-caption connection-chip-long">남은</span>
              <span className="connection-chip-value">{credits.toLocaleString('ko-KR')}</span>
              <span className="sr-only">크레딧</span>
            </span>
          )}
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
              {/* What the three words choose: how often she speaks first (the group's name says it to screen readers). */}
              <span className="connection-talk-label" aria-hidden="true"><Icon name="chat" size={13} />말 걸기</span>
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
              data-speaking={talking || voicePlaying || undefined}
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
            {/* The dialogue box (C1 「대사창」) over the dock, chat open or closed; 「누르고 말하기」's heard text,
                the sentence before it goes out and its notices stack over it. */}
            <CallDialogueBox
              name={mate.name}
              line={stageLine}
              waiting={sending && !ending}
              speaking={talking || voicePlaying}
              linger={voicePlaying}
              announce={stageLineRead}
              onTypingChange={setLineTyping}
              onDone={setLineDone}
              above={(pushToTalk.snapshot.status !== 'idle' || pushToTalk.snapshot.notice || (pushToTalk.privacy && !pip.window)) && (
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
            />
          </div>

          {(creditInsufficient || floatingErrors.length > 0 || (showAffinity && sync.stageUp) || voice.status === 'blocked' || voiceIntro || (voiceOn && voiceUnavailable) || (voiceNote === 'shown' && !chatOpen)) && (
            <div className="connection-floating-notices" aria-live="polite">
              {voiceNote === 'shown' && !chatOpen && voiceFallbackNote}
              {/* 메이트 음성 is on but this browser could not prepare the audio: no voice is asked for (or paid). */}
              {voiceOn && voiceUnavailable && (
                <div className="connection-notice-card connection-voice-unavailable" role="status">
                  <Icon name="headphones" size={16} />
                  {VOICE_UNAVAILABLE}
                </div>
              )}
              {voiceIntro && (
                <div className="connection-notice-card connection-voice-intro" role="status">
                  <Icon name="headphones" size={16} />
                  메이트 목소리로 답해요 · 답장마다 {CREDIT_PRICING.voice} 크레딧
                </div>
              )}
              {/* The browser held her voice until a click or key press (autoplay rule); any press allows it, this too. */}
              {voice.status === 'blocked' && (
                <button type="button" className="connection-notice-card connection-voice-unlock" onClick={voice.player.unlock}>
                  <Icon name="headphones" size={16} />
                  소리 켜기
                </button>
              )}
              {/* With the chat open, the log's stage-up line says it (the card would repeat it next to the panel). */}
              {showAffinity && <StageUpNotice stageUp={sync.stageUp} world={mateFeatures.world} mateId={mate.id} mateName={mate.name} inLog={chatOpen} />}
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
            {/* P1 「픽셀 대화 기록」 (2026-11-28): the dithered roof and capsule, her mini profile (face, the call's green dot,
                「통화 중 · 함께 N분」 from the call timer, 「입력 중」 while her reply is on its way) and a still close X. */}
            <header className="connection-chat-head">
              <PixelRoofStrip />
              <span className="connection-chat-avatar" aria-hidden="true">
                {mateFace ? <img src={mateFace} width={36} height={36} alt="" draggable={false} /> : <Icon name="user" size={18} />}
                <span className="connection-chat-status-dot" />
              </span>
              <div className="connection-chat-who">
                <h2 id="connection-chat-title">{mate.name}<span className="sr-only">{withParticle(mate.name, '과', '와').slice(mate.name.length)} 대화</span></h2>
                <p className="connection-chat-status">
                  {replyOnItsWay
                    ? <><span className="connection-chat-typing" aria-hidden="true"><span /><span /><span /></span>입력 중</>
                    : `통화 중 · ${callMinutes < 1 ? '방금 시작' : `함께 ${callMinutes}분`}`}
                </p>
              </div>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="대화창 닫기" className="connection-chat-close">
                <StillClose />
              </button>
            </header>
            <div className="connection-log-wrap">
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
                if (followMessages.current) setUnread(0)
                if (node && node.scrollTop < 48 && chat.room.nextCursor && !chat.room.failed) void loadOlderMessages()
              }}
            >
              <ChatHistoryStatus room={chat.room} onRetry={chat.retry} />
              {/* Nothing said yet: one short line and the first words (the quick replies, moved up from the composer). */}
              {chatEmpty && (
                <div className="connection-chat-empty">
                  <span className="connection-chat-empty-art" aria-hidden="true">
                    <PixelImage name="capsule" scale={3} />
                    <PixelImage name="spark" className="connection-chat-empty-star" />
                    <PixelImage name="snowDotLilac" className="connection-chat-empty-star" />
                    <PixelImage name="spark" scale={1} className="connection-chat-empty-star" />
                  </span>
                  <p className="connection-chat-empty-text">{mate.name}에게 먼저 말 걸어 볼까요?</p>
                  <div className="connection-chat-starters" role="group" aria-label="첫마디">
                    {QUICK_REPLIES.map(text => (
                      <button key={text} type="button" disabled={sending || speaking || finishing} onClick={() => { void send(text, 'QUICK') }}>{text}</button>
                    ))}
                  </div>
                </div>
              )}
              <ChatLogGroups
                lines={messages}
                mateName={mate.name}
                mateFace={mateFace}
                userName={state.profile.name}
                now={now}
                notes={showAffinity ? callNotes : undefined}
                renderNote={note => <StageUpLine stage={note.stage} stageName={note.stageName} unlocked={note.unlocked} world={mateFeatures.world} mateId={mate.id} mateName={mate.name} />}
                typing={sending && messages.at(-1)?.sender !== 'character'}
                renderText={message => (
                  message.sender === 'character' && message.requestId && chat.room.reported.has(message.requestId) ? (
                    <ReportedReply text={message.text} />
                  ) : message.sender === 'character' && chat.localIds.has(message.id) ? (
                    <TypingMessage
                      id={message.id}
                      text={message.text}
                      seen={seenMessages}
                      onProgress={scrollLatest}
                      onTypingChange={reportTyping}
                    />
                  ) : (
                    message.text
                  )
                )}
                // 40 · 41 on a confirmed reply (not in the PIP window).
                renderActions={message => (
                  message.sender === 'character' && message.requestId && message.delivery !== 'pending' && state.profile.userId !== undefined &&
                    !chat.room.reported.has(message.requestId) ? (
                      <ReplyActions userId={state.profile.userId} characterId={mate.characterId} requestId={message.requestId} rating={chat.room.ratings[message.requestId] ?? null} />
                    ) : null
                )}
              />
            </div>
            {unread > 0 && (
              <button type="button" className="connection-new-pill" onClick={jumpToLatest}>
                새 메시지{unread > 1 ? ` ${unread}개` : ''}<span aria-hidden="true"> ↓</span>
              </button>
            )}
            </div>
            {creditShort && (
              <CreditShortNotice
                credits={creditShort.credits}
                busy={sending}
                onClose={() => setCreditShort(null)}
                onBasic={() => {
                  const retry = creditShort
                  chooseMode('basic')
                  void send(retry.text, retry.inputType)
                }}
              />
            )}
            {voiceNote === 'shown' && voiceFallbackNote}
            {error && (
              <div className="connection-chat-error">
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
              </div>
            )}
            <ChatComposer
              name={mate.name}
              text={draft}
              onChange={setDraft}
              onSend={sendTyped}
              sendDisabled={sending || speaking || finishing}
              waiting={sending}
              hint
              quickReplies={chatEmpty ? undefined : QUICK_REPLIES}
              onQuickReply={(text) => { void send(text, 'QUICK') }}
              // The same 누르고 말하기 as the dock's button (one press at a time, usePushToTalk).
              talk={{
                supported: pushToTalk.supported,
                listening: pushToTalk.snapshot.status === 'listening',
                disabled: finishing,
                label: !pushToTalk.supported ? PUSH_TO_TALK_TEXT.unsupported : pushToTalk.snapshot.status === 'listening' ? '듣는 중 · 떼면 보내요' : '누르고 말하기',
                onPressStart: () => pushToTalk.press('composer', window),
                onPressEnd: () => pushToTalk.release('composer'),
              }}
            />
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

      {/* 「카메라 없이 하기」 is the way back (Esc and the backdrop do the same), so no X in the header (2026-11-26). */}
      <Dialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="카메라 사용 안내" tone="info" showCloseButton={false}>
        <p className="text-muted">카메라를 켜면 자리 비움·복귀에 메이트가 반응해요. 영상은 이 기기 안에서만 확인하고 저장하거나 보내지 않아요.</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => { setPrivacySeen(true); setPrivacyOpen(false); void controller.request('camera') }}>카메라 켜기</Button>
          <Button variant="secondary" onClick={() => setPrivacyOpen(false)} data-dialog-initial-focus>카메라 없이 하기</Button>
        </div>
      </Dialog>

      <Dialog
        open={leaveOpen}
        onClose={() => { if (!finishing) setLeaveOpen(false) }}
        dismissible={!finishing}
        // 「계속하기」 is the way back (Esc and the backdrop do the same), so no X in the header (2026-11-26).
        showCloseButton={false}
        title={`${withParticle(mate.name, '과', '와')}의 연결을 끊을까요?`}
        className="connection-leave-dialog"
      >
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
      </Dialog>
    </main>
  )
}
