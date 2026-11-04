import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { BREAK_SECONDS, sessionElapsed, sessionStudySeconds } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { studyGoalSeconds } from '@/features/session/study-goal'
import { isStudyChatOpen, SELF_STUDY_TILE_ID, selectBreakFriend, selectStudyChatFriend, toggleBreakSelfFocus, toggleStudyChat, toggleStudyFocus } from '@/features/session/study-interaction'
import { focusPercent, normalizeFocusTotals } from '@/features/session/focus'
import { useNow } from '@/features/session/use-now'
import { requestCharacterReply, type ChatReplyMode } from '@/features/session/llm-chat'
import { behaviorPromptText, createBehaviorChatState, reactToBehavior, typingEndsAt, withRecentBehavior } from '@/features/session/behavior-chat'
import type { BehaviorChange } from '@/features/media/behavior-monitor'
import { CharacterTile } from '@/features/session/components/CharacterTile'
import { StudyGrid } from '@/features/session/components/StudyGrid'
import { StudyDock } from '@/features/session/components/StudyDock'
import { StudySelfView } from '@/features/session/components/StudySelfView'
import { StudyDemoControls } from '@/features/session/components/StudyDemoControls'
import { SessionTimer } from '@/features/session/components/SessionTimer'
import { SessionFocus } from '@/features/session/components/SessionFocus'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { DetectionStatus } from '@/features/media/components/DetectionStatus'
import { BehaviorBadges } from '@/features/media/components/BehaviorBadges'
import { DevicePrivacyInfo } from '@/features/media/components/DevicePrivacyInfo'
import { useMedia } from '@/features/media/media-context'
import { useMicrophoneActivity } from '@/features/media/use-microphone-activity'
import { updateSpeakingMessages, type SpeakingMessages } from '@/features/session/speaking-activity'
import { normalizeCameraBackground } from '@/features/media/camera-backgrounds'
import { Brand } from '@/shared/ui/Brand'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { SessionChatPanel } from '@/features/session/components/SessionChatPanel'
import { clock } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { isMvpCharacter } from '@/features/mvp/policy'

const reactions = ['', '…', '잠깐 자리 비운 거야?', '…나랑 공부하기 싫어?']

export default function StudyPage() {
  const { state, dispatch } = useDemo()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [reaction, setReaction] = useState(0)
  const [customSpeech, setCustomSpeech] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [replyMode, setReplyMode] = useState<ChatReplyMode>('scripted')
  const [pendingReplies, setPendingReplies] = useState<Record<string, boolean>>({})
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})
  const [speakingMessages, setSpeakingMessages] = useState<SpeakingMessages>({})
  const [selfChatUntil, setSelfChatUntil] = useState(0)
  const reportTyping = useCallback((characterId: string, messageId: string, typing: boolean) => {
    setSpeakingMessages(current => updateSpeakingMessages(current, characterId, messageId, typing))
  }, [])
  const { devices, controller, flushFocus, behavior } = useMedia()
  const behaviorChat = useRef(createBehaviorChatState())
  const now = useNow()
  const active = state.activeSession
  const inSession = active?.id === sessionId
  const microphoneSpeaking = useMicrophoneActivity(inSession ? devices.microphone.stream : null)
  const selfSpeaking = microphoneSpeaking || now < selfChatUntil
  const speakingCharacters = new Set(Object.values(speakingMessages))
  const resting = active?.phase === 'break'
  const room = active && getStudyRoom(active.roomId)
  const characters = room?.characters.filter(character => isMvpCharacter(character.id) && active?.characterIds.includes(character.id)) ?? []
  const focused = characters.find(character => character.id === params.get('focus'))
  const selfFocused = params.get('focus') === SELF_STUDY_TILE_ID
  const hasFocus = !!focused || selfFocused
  const selected = characters.find(character => character.id === params.get('friend')) ?? focused ?? characters[0]
  const chatOpen = isStudyChatOpen(params, resting)
  const previousPhase = useRef(active?.phase)
  useEffect(() => { behaviorChat.current = createBehaviorChatState() }, [sessionId])
  const onBehaviorChange = useEffectEvent((change: BehaviorChange) => {
    // Same guard as the early return below, so the handler only runs after a full render of this session.
    const session = state.activeSession
    if (session && session.id === sessionId && getStudyRoom(session.roomId) && selected) reactToDetection(change)
  })
  useEffect(() => behavior.onChange((change) => onBehaviorChange(change)), [behavior])
  useEffect(() => {
    if (inSession && previousPhase.current === 'break' && active?.phase === 'study') {
      // Automatic rest completion returns to the study view while preserving conversations.
      setParams(current => {
        const next = new URLSearchParams(current)
        next.set('chat', '0')
        return next
      }, { replace: true })
    }
    previousPhase.current = active?.phase
  }, [active?.phase, inSession, setParams])
  useLayoutEffect(() => {
    if (!inSession || !hasFocus || (resting && !selfFocused) || !window.matchMedia('(max-width: 1023px)').matches) return
    const tile = document.querySelector<HTMLElement>(resting ? '.break-self-tile.focus-tile' : '.study-grid > .focus-tile')
    if (!tile) return
    const headerHeight = document.querySelector('.study-topbar')?.getBoundingClientRect().height ?? 0
    // A tile selected below the fold moves to the top; keep its enlarged view below the sticky header.
    window.scrollTo({ top: Math.max(0, window.scrollY + tile.getBoundingClientRect().top - headerHeight - 12), behavior: 'instant' })
  }, [focused?.id, selfFocused, hasFocus, inSession, resting])
  useEffect(() => {
    if (!inSession || !selected) return
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog:modal:not(#session-chat)')) return
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (editing && event.isComposing) return
      const key = event.code === 'KeyV' ? 'v' : event.code === 'KeyC' ? 'c' : event.key.toLowerCase()
      if (!editing && key === 'c') {
        event.preventDefault()
        if (event.repeat) return
        const next = toggleStudyChat(new URLSearchParams(window.location.search), selected.id, resting)
        if (next.get('chat') === '1') {
          setReaction(0)
          setCustomSpeech('')
        }
        setParams(next)
      } else if (!editing && key === 'v' && !resting && !document.querySelector('dialog:modal')) {
        event.preventDefault()
        if (event.repeat) return
        setParams(toggleStudyFocus(new URLSearchParams(window.location.search), selfFocused ? SELF_STUDY_TILE_ID : focused?.id ?? selected.id))
      } else if (event.key === 'Escape' && !event.isComposing) {
        // Read the latest location so successive Escape presses close one layer each.
        const next = new URLSearchParams(window.location.search)
        const chatting = isStudyChatOpen(next, resting)
        if (!chatting && !next.has('focus')) return
        event.preventDefault()
        if (chatting) next.set('chat', '0')
        else next.delete('focus')
        setParams(next)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [inSession, resting, focused?.id, selfFocused, selected, setParams])
  if (!active || active.id !== sessionId || !room || !selected)
    return (
      <main id="main-content" tabIndex={-1} className="page-container grid min-h-dvh place-items-center py-10 focus:outline-none">
        <PageNavigation />
        <EmptyState title="진행 중인 공부가 없어요" headingLevel="h1" />
      </main>
    )
  const elapsed = sessionElapsed(active, now)
  const goal = studyGoalSeconds(active)
  const focusTotals = normalizeFocusTotals(active.focus)
  const focusRate = focusPercent(focusTotals.focusedMs, focusTotals.observedMs)
  const cameraVisible = showCamera && !!devices.camera.stream
  const messages = state.messages.filter(
    (message) => message.sessionId === active.id && message.characterId === selected.id,
  )
  const lastReply = messages.filter((message) => message.sender === 'character').at(-1)
  const orderedCharacters = focused
    ? [focused, ...characters.filter(character => character.id !== focused.id)]
    : characters
  // Keep a stable key for my tile when moving it into the expanded position.
  const studyTiles = selfFocused ? [null, ...characters] : [...orderedCharacters, null]
  function resumeStudy() {
    const next = new URLSearchParams(params)
    next.delete('resume')
    setParams(next, { replace: true })
    dispatch({ type: 'RESUME_SESSION', now: Date.now() })
  }
  function closeChat() {
    const next = new URLSearchParams(params)
    next.set('chat', '0')
    setParams(next)
  }
  function toggleChat() {
    const next = toggleStudyChat(params, selected!.id, resting)
    if (next.get('chat') === '1') {
      setReaction(0)
      setCustomSpeech('')
    }
    setParams(next)
  }
  function selectFriend(id: string) {
    setParams(selectStudyChatFriend(params, id))
  }
  function activateFriend(id: string) {
    setParams(toggleStudyFocus(params, id))
  }
  function send(text: string, voice = false) {
    if (!selected || !text.trim()) return
    if (replyMode === 'llm' && pendingReplies[selected.id]) return
    setSelfChatUntil(Date.now() + 1400)
    dispatch({ type: 'MESSAGE', characterId: selected.id, name: selected.name, text, voice, now, reply: replyMode })
    setCustomSpeech('')
    if (replyMode === 'llm') void askCharacter(selected, withRecentBehavior(text, behaviorChat.current.recent, behavior.getSnapshot(), Date.now()))
  }
  /** A new detection may make a friend speak first; requests are dropped while any friend is replying. */
  function reactToDetection(change: BehaviorChange) {
    const at = Date.now()
    const speaking = Object.values(pendingReplies).some(Boolean) || state.messages.some((message) =>
      message.sessionId === active!.id && message.sender === 'character' && typingEndsAt(message.text, message.createdAt ?? 0) > at)
    const unavailable = replyMode !== 'llm' || active!.phase !== 'study' || active!.runningSince === null
    const result = reactToBehavior(behaviorChat.current, change, unavailable || speaking)
    behaviorChat.current = result.state
    // With the chat closed, the reply shows as the first tile's speech bubble.
    const character = chatOpen ? selected : focused ?? characters[0]
    if (result.prompt && character) void askCharacter(character, behaviorPromptText(result.prompt), !chatOpen)
  }
  async function askCharacter(character: (typeof characters)[number], text: string, speakFirst = false) {
    const { id: sessionId, phase } = active!
    const history = state.messages
      .filter((message) => message.sessionId === sessionId && message.characterId === character.id)
      .map(({ sender, text }) => ({ sender, text }))
    setPendingReplies((previous) => ({ ...previous, [character.id]: true }))
    setReplyErrors((previous) => ({ ...previous, [character.id]: '' }))
    try {
      const reply = await requestCharacterReply({
        userName: state.profile.name,
        room: { name: room!.name, description: room!.description },
        character: { name: character.name, description: character.description },
        phase,
        elapsedMinutes: (phase === 'study' ? elapsed : active!.studySeconds) / 60,
        goalMinutes: goal / 60,
        history,
        text,
      })
      dispatch({ type: 'CHARACTER_REPLY', sessionId, characterId: character.id, text: reply, now: Date.now() })
      if (speakFirst) { setReaction(0); setCustomSpeech(reply) }
    } catch (error) {
      setReplyErrors((previous) => ({ ...previous, [character.id]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setPendingReplies((previous) => ({ ...previous, [character.id]: false }))
    }
  }
  function finish() {
    flushFocus()
    controller.stop()
    dispatch({ type: 'FINISH', now: Date.now() })
    navigate(`/reports/${active!.id}`)
  }
  async function toggleCamera() {
    if (devices.camera.stream) {
      flushFocus()
      controller.stop('camera')
      setShowCamera(false)
      dispatch({ type: 'CAMERA', enabled: false })
    } else {
      const enabled = await controller.request('camera')
      dispatch({ type: 'CAMERA', enabled })
    }
  }
  async function toggleSelfView() {
    if (cameraVisible) {
      setShowCamera(false)
      return
    }
    const enabled = await controller.request('camera')
    dispatch({ type: 'CAMERA', enabled })
    setShowCamera(enabled)
  }
  function takeBreak() {
    flushFocus()
    dispatch({ type: 'TAKE_BREAK', now: Date.now() })
    const next = new URLSearchParams(params)
    next.delete('focus')
    next.set('chat', '1')
    setParams(next)
  }
  function continueStudy() {
    dispatch({ type: 'CONTINUE_STUDY', now: Date.now() })
    setReaction(0)
    setCustomSpeech('')
    const next = new URLSearchParams(params)
    next.set('chat', '0')
    setParams(next)
  }
  function dock(resting = false) {
    return (
      <StudyDock
        chatOpen={chatOpen}
        onChatToggle={toggleChat}
        onPhaseToggle={resting ? continueStudy : takeBreak}
        onFinish={() => setLeaveOpen(true)}
        camera={devices.camera}
        microphone={devices.microphone}
        showCamera={cameraVisible}
        onCamera={() => { void toggleCamera() }}
        onMicrophone={() => devices.microphone.stream ? controller.stop('microphone') : void controller.request('microphone')}
        onViewChange={() => { void toggleSelfView() }}
        background={normalizeCameraBackground(state.cameraBackground)}
        onBackgroundChange={(background) => {
          dispatch({ type: 'CAMERA_BACKGROUND', background })
        }}
        resting={resting}
      />
    )
  }
  function selfTile(small = false) {
    return (
      <article key={SELF_STUDY_TILE_ID} aria-label={resting ? cameraVisible ? '내 카메라' : '내 아바타' : '내 칸'}
        className={cn(resting && 'break-self-tile', resting && !selfFocused ? 'break-thumbnail bg-surface' : 'self-tile', selfFocused && 'focus-tile', selfSpeaking && 'is-speaking')} data-speaking={selfSpeaking || undefined}>
        {selfSpeaking && <span className="sr-only">{microphoneSpeaking ? '음성 입력 중' : '메시지 전송'}</span>}
        <StudySelfView stream={devices.camera.stream} showCamera={cameraVisible} avatar={state.profile.avatar} background={normalizeCameraBackground(state.cameraBackground)} small={small} expanded={selfFocused} />
        <button type="button" className="tile-interaction" aria-label={selfFocused ? '내 화면 확대 닫기' : '내 화면 크게 보기'}
          aria-expanded={selfFocused} onClick={() => setParams(resting ? toggleBreakSelfFocus(params, selected!.id) : toggleStudyFocus(params, SELF_STUDY_TILE_ID))}>
          <span className="tile-action-symbol" aria-hidden="true">
            <Icon name={selfFocused ? 'shrink' : 'zoomIn'} size={28} />
          </span>
        </button>
        {!resting && <div className="study-self-feedback">
          <DetectionStatus />
          <BehaviorBadges />
          {devices.camera.error && <FeedbackMessage tone="error" compact>{devices.camera.error}</FeedbackMessage>}
          {devices.microphone.error && <FeedbackMessage tone="error" compact>{devices.microphone.error}</FeedbackMessage>}
        </div>}
      </article>
    )
  }
  return (
    <main id="main-content" tabIndex={-1} className="study-shell focus:outline-none">
      <PageNavigation />
      <h1 className="sr-only type-page-title">
        {room.name} · {active.phase === 'study' ? '공부 중' : '쉬는 시간'}
      </h1>
      <header className="study-topbar">
        <Link
          to="/"
          aria-label="CAPSULE 홈"
          aria-haspopup="dialog"
          onClick={(event) => {
            // Leaving mid-session asks first; modified clicks still open home in a new tab.
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            setLeaveOpen(true)
          }}
        >
          <Brand />
        </Link>
        <div className="study-room-heading">
          <span className="study-room-name">{room.name}</span>
          <StudyDemoControls
            studying={active.phase === 'study'}
            onBreak={takeBreak}
            onReaction={(level) => { setReaction(level); setCustomSpeech('') }}
            onReturn={() => { setReaction(0); setCustomSpeech('오, 돌아왔네. 계속 가자.') }}
          />
        </div>
        <div className="study-header-actions">
        <DevicePrivacyInfo />
        </div>
        <div className="study-session-stats">
          <SessionFocus rate={focusRate} />
          <SessionTimer
            elapsed={active.phase === 'study' ? sessionStudySeconds(active, now) : elapsed}
            duration={active.phase === 'study' ? goal : BREAK_SECONDS}
            resting={active.phase === 'break'}
          />
        </div>
      </header>
      <div className="study-workspace" data-chat-open={chatOpen || undefined}>
      {active.phase === 'study' ? (
        <div className="study-stage">
          <StudyGrid focused={hasFocus}>
            {studyTiles.map((character, tileIndex) => {
              if (!character) return selfTile(hasFocus && !selfFocused)
              const index = tileIndex - Number(selfFocused)
              return <CharacterTile
                key={character.id}
                character={character}
                variant={
                  hasFocus
                    ? character.id === focused?.id
                      ? 'focus'
                      : 'small'
                    : index === 0
                      ? 'grid'
                      : 'quiet'
                }
                focus={focused?.id === character.id}
                speaking={speakingCharacters.has(character.id)}
                active={(chatOpen && character.id === selected.id) || (index === 0 && reaction > 1)}
                status={
                  speakingCharacters.has(character.id)
                    ? '말하는 중'
                    : chatOpen && character.id === selected.id
                      ? '채팅 중'
                      : index === 0 && reaction
                        ? reaction === 1
                          ? '힐끔'
                          : '말 거는 중'
                        : '공부 중'
                }
                speech={
                  character.id === selected.id && chatOpen
                    ? undefined
                    : index === 0
                      ? customSpeech || reactions[reaction]
                      : index === 1 && reaction
                        ? '…'
                        : undefined
                }
                onActivate={() => activateFriend(character.id)}
                onDismiss={
                  index === 0 && reaction > 1 && !chatOpen
                    ? () => {
                        setReaction(0)
                        setCustomSpeech('아, 필기 중이었구나. 미안!')
                      }
                    : undefined
                }
              />
            })}
          </StudyGrid>
          {dock()}
        </div>
      ) : (
          <div className="break-stage" data-self-focused={selfFocused || undefined}>
            <CharacterTile
              character={selected}
              variant="rest"
              speaking={speakingCharacters.has(selected.id)}
              status={speakingCharacters.has(selected.id) ? '말하는 중' : '쉬는 중'}
              speech={chatOpen ? undefined : lastReply?.text ?? '그럼 조금만 더 쉬어. 내가 시간 봐 줄게.'}
            />
            <div className="break-thumbnails">
              <div className="break-friend-thumbnails">
                {characters
                  .filter((character) => selfFocused || character.id !== selected.id)
                  .map((character) => (
                    <button
                      key={character.id}
                      onClick={() => {
                        setParams(selectBreakFriend(params, character.id))
                      }}
                      className={cn('break-thumbnail', speakingCharacters.has(character.id) && 'is-speaking')}
                      data-speaking={speakingCharacters.has(character.id) || undefined}
                    >
                      <img
                        src={getCharacterArtwork(character.id).affection}
                        alt=""
                        className="size-full object-cover"
                      />
                      <span className="tile-label">{character.name} · 쉬는 중</span>
                    </button>
                  ))}
              </div>
              {selfTile(!selfFocused)}
            </div>
            {dock(true)}
            <div className="break-device-feedback">
              {devices.camera.error && <FeedbackMessage tone="error" compact className="break-device-error">{devices.camera.error}</FeedbackMessage>}
              {devices.microphone.error && <FeedbackMessage tone="error" compact className="break-device-error">{devices.microphone.error}</FeedbackMessage>}
            </div>
          </div>
      )}
          <SessionChatPanel
            open={chatOpen && !leaveOpen && params.get('resume') !== '1' && !(active.phase === 'study' && active.runningSince === null)}
            onClose={closeChat}
            characters={characters}
            selected={selected}
            onSelect={selectFriend}
            onSend={send}
            onTypingChange={reportTyping}
            replyMode={replyMode}
            onReplyModeChange={setReplyMode}
            replyPending={!!pendingReplies[selected.id]}
            replyError={replyErrors[selected.id]}
          />
      </div>
      <Dialog
        open={params.get('resume') === '1' || (active.phase === 'study' && active.runningSince === null)}
        onClose={() => navigate('/')}
        closeLabel="홈으로 돌아가기"
        title="다시 공부를 시작할까요?"
      >
        <p className="mb-5 text-body-compact leading-6 text-muted">
          {room.name}에서 {active.phase === 'study' ? '하던 공부를' : '쉬는 시간을'} 이어서 진행해요.
          준비되면 시작해 주세요.
        </p>
        <Button className="w-full" onClick={resumeStudy}>
          <Icon name="play" size={17} /> 이어서 시작할게
        </Button>
      </Dialog>
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="공부를 마치시겠습니까?" showCloseButton={false} titleAlign="center">
        <dl className="mb-4 flex items-center justify-between gap-4 rounded-control bg-surface p-4">
          <dt className="text-body-compact text-muted">지금까지 공부한 시간</dt>
          <dd className="text-section-title font-bold tabular-nums" data-study-total>{clock(sessionStudySeconds(active, now))}</dd>
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="danger-solid" onClick={() => { setLeaveOpen(false); finish() }}>응, 여기까지 할게</Button>
          <Button variant="secondary" data-dialog-initial-focus onClick={() => setLeaveOpen(false)}>
            아니, 더 할거야
          </Button>
        </div>
      </Dialog>
    </main>
  )
}
