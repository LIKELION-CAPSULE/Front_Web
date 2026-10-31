import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { tierById } from '@/features/demo/catalog'
import { BREAK_SECONDS, sessionElapsed } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { studyGoalSeconds } from '@/features/session/study-goal'
import { activateStudyFriend, type StudyInteractionMode } from '@/features/session/study-interaction'
import { focusPercent, normalizeFocusTotals } from '@/features/session/focus'
import { useNow } from '@/features/session/use-now'
import { requestCharacterReply, type ChatReplyMode } from '@/features/session/llm-chat'
import { CharacterTile } from '@/features/session/components/CharacterTile'
import { StudyDock } from '@/features/session/components/StudyDock'
import { StudySelfView } from '@/features/session/components/StudySelfView'
import { StudyDemoControls } from '@/features/session/components/StudyDemoControls'
import { SessionTimer } from '@/features/session/components/SessionTimer'
import { SessionFocus } from '@/features/session/components/SessionFocus'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { DetectionStatus } from '@/features/media/components/DetectionStatus'
import { useMedia } from '@/features/media/media-context'
import { normalizeCameraBackground } from '@/features/media/camera-backgrounds'
import { Brand } from '@/shared/ui/Brand'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { SessionChatPanel } from '@/features/session/components/SessionChatPanel'
import { businessDay } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'

const reactions = ['', '…', '잠깐 자리 비운 거야?', '…나랑 공부하기 싫어?']

export default function StudyPage() {
  const { state, dispatch } = useDemo()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [reaction, setReaction] = useState(0)
  const [customSpeech, setCustomSpeech] = useState('')
  const [quietMode, setQuietMode] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [replyMode, setReplyMode] = useState<ChatReplyMode>('scripted')
  const [pendingReplies, setPendingReplies] = useState<Record<string, boolean>>({})
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})
  const [interactionMode, setInteractionMode] = useState<StudyInteractionMode>(() => params.get('chat') === '1' ? 'talk' : 'focus')
  const { devices, controller, flushFocus } = useMedia()
  const now = useNow()
  const active = state.activeSession
  const inSession = active?.id === sessionId
  const resting = active?.phase === 'break'
  useEffect(() => {
    if (!inSession) return
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog:modal')) return
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (editing && event.isComposing) return
      const key = event.code === 'KeyV' ? 'v' : event.code === 'KeyC' ? 'c' : event.key.toLowerCase()
      if (!editing && (key === 'v' || key === 'c')) {
        event.preventDefault()
        setInteractionMode(key === 'v' ? 'focus' : 'talk')
        if (key === 'c') {
          setQuietMode(false)
          const next = new URLSearchParams(window.location.search)
          next.set('chat', '1')
          setParams(next)
        }
      } else if (event.key === 'Escape' && !event.isComposing) {
        // Read the latest location so successive Escape presses close one layer each.
        const next = new URLSearchParams(window.location.search)
        const chatting = next.get('chat') === '1' || (resting && !next.has('chat'))
        if (!chatting && !next.has('focus')) return
        event.preventDefault()
        if (chatting) next.set('chat', '0')
        else next.delete('focus')
        setParams(next)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [inSession, resting, setParams])
  const room = active && getStudyRoom(active.roomId)
  if (!active || active.id !== sessionId || !room)
    return (
      <main id="main-content" className="page-container py-10">
        <PageNavigation />
        <EmptyState title="진행 중인 공부가 없어요" headingLevel="h1">
          스터디룸을 골라 친구와 공부를 시작해 보세요.
        </EmptyState>
      </main>
    )
  const characters = room.characters.filter((character) =>
    active.characterIds.includes(character.id),
  )
  const focusId = params.get('focus')
  const focused = characters.find((character) => character.id === focusId)
  const selected = characters.find((character) => character.id === params.get('friend')) ?? focused ?? characters[0]!
  const chatOpen = params.get('chat') === '1' || (active.phase === 'break' && !params.has('chat'))
  const elapsed = sessionElapsed(active, now)
  const goal = studyGoalSeconds(active)
  const focusTotals = normalizeFocusTotals(active.focus)
  const focusRate = focusPercent(focusTotals.focusedMs, focusTotals.observedMs)
  const cameraVisible = showCamera && !!devices.camera.stream
  const remaining = Math.max(0, (active.phase === 'study' ? goal : BREAK_SECONDS) - elapsed)
  const used = state.chatUsage.day === businessDay(now) ? state.chatUsage.used : 0
  const messages = state.messages.filter(
    (message) => message.sessionId === active.id && message.characterId === selected.id,
  )
  const lastReply = messages.filter((message) => message.sender === 'character').at(-1)
  function resumeStudy() {
    const next = new URLSearchParams(params)
    next.delete('resume')
    setParams(next, { replace: true })
    if (active!.runningSince === null && remaining > 0) dispatch({ type: 'PAUSE', now: Date.now() })
  }
  function closeChat() {
    const next = new URLSearchParams(params)
    next.set('chat', '0')
    setParams(next)
  }
  function selectMode(mode: StudyInteractionMode) {
    setInteractionMode(mode)
    if (mode === 'talk') {
      setQuietMode(false)
      setParams(activateStudyFriend(params, 'talk', selected.id))
    }
  }
  function selectFriend(id: string) {
    setQuietMode(false)
    setParams(activateStudyFriend(params, 'talk', id))
  }
  function activateFriend(id: string) {
    if (interactionMode === 'talk') {
      setQuietMode(false)
      setReaction(0)
      setCustomSpeech('')
    }
    setParams(activateStudyFriend(params, interactionMode, id))
  }
  function send(text: string, voice = false) {
    if (active!.tier === 'basic' && used >= 3) {
      return
    }
    if (replyMode === 'llm' && pendingReplies[selected.id]) return
    dispatch({ type: 'MESSAGE', characterId: selected.id, name: selected.name, text, voice, now, reply: replyMode })
    setCustomSpeech('')
    if (replyMode === 'llm') void askCharacter(selected, text)
  }
  async function askCharacter(character: (typeof characters)[number], text: string) {
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
        elapsedMinutes: (phase === 'study' ? elapsed : goal) / 60,
        goalMinutes: goal / 60,
        history,
        text,
      })
      dispatch({ type: 'CHARACTER_REPLY', sessionId, characterId: character.id, text: reply, now: Date.now() })
    } catch (error) {
      setReplyErrors((previous) => ({ ...previous, [character.id]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setPendingReplies((previous) => ({ ...previous, [character.id]: false }))
    }
  }
  function finish(another = false) {
    flushFocus()
    controller.stop()
    dispatch({ type: 'FINISH', now: Date.now() })
    navigate(
      another
        ? `/rooms/${room!.id}/prepare?goal=${Math.round(studyGoalSeconds(active!) / 60)}`
        : `/reports/${active!.id}`,
    )
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
  function dock(resting = false) {
    return (
      <StudyDock
        mode={interactionMode}
        onModeChange={selectMode}
        paused={active!.runningSince === null}
        onPause={() => { flushFocus(); dispatch({ type: 'PAUSE', now: Date.now() }) }}
        onFinish={() => finish()}
        camera={devices.camera}
        microphone={devices.microphone}
        showCamera={cameraVisible}
        onCamera={() => { void toggleCamera() }}
        onMicrophone={() => devices.microphone.stream ? controller.stop('microphone') : void controller.request('microphone')}
        onViewChange={() => { void toggleSelfView() }}
        background={normalizeCameraBackground(state.cameraBackground)}
        onBackgroundChange={(background) => dispatch({ type: 'CAMERA_BACKGROUND', background })}
        resting={resting}
        restFinished={resting && remaining === 0}
      />
    )
  }
  function selfTile(small = false) {
    return (
      <article aria-label="내 칸" className="self-tile">
        <StudySelfView stream={devices.camera.stream} showCamera={cameraVisible} avatar={state.profile.avatar} small={small} />
        <div className="study-self-feedback">
          <DetectionStatus />
          {devices.camera.error && <p role="alert">{devices.camera.error}</p>}
          {devices.microphone.error && <p role="alert">{devices.microphone.error}</p>}
        </div>
      </article>
    )
  }
  return (
    <main id="main-content" tabIndex={-1} className="study-shell focus:outline-none">
      <PageNavigation />
      <h1 className="sr-only">
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
            onBreak={() => dispatch({ type: 'SKIP_TO_BREAK', now: Date.now() })}
            onReaction={(level) => { setReaction(level); setCustomSpeech('') }}
            onReturn={() => { setReaction(0); setCustomSpeech('오, 돌아왔네. 계속 가자.') }}
          />
        </div>
        <div className="study-header-actions">
        {active.phase === 'study' && (
          <button
            type="button"
            aria-pressed={quietMode}
            onClick={() => {
              setQuietMode(!quietMode)
              if (!quietMode) {
                setInteractionMode('focus')
                if (chatOpen) closeChat()
              }
            }}
            className="quiet-mode-toggle"
            aria-label="조용히 집중"
          >
            <Icon name="moon" size={14} />
            <span>조용히 집중</span>
          </button>
        )}
        <button type="button" className="study-chat-trigger" aria-label={chatOpen ? '대화 닫기' : '대화 열기'} aria-expanded={chatOpen} aria-controls="session-chat" onClick={() => chatOpen ? closeChat() : selectMode('talk')} title="친구와 대화"><Icon name="chat" size={16} /></button>
        </div>
        <div className="study-session-stats">
          <SessionFocus rate={focusRate} />
          <SessionTimer
            elapsed={elapsed}
            duration={active.phase === 'study' ? goal : BREAK_SECONDS}
            resting={active.phase === 'break'}
            paused={active.runningSince === null}
            tier={tierById(active.tier).name}
          />
        </div>
      </header>
      <div className="study-workspace" data-chat-open={chatOpen || undefined}>
      {active.phase === 'study' ? (
        <div className="study-stage">
          <div
            data-interaction-mode={interactionMode}
            className={cn(
              'study-grid',
              focused && 'is-focus',
              characters.length === 1 && 'is-one-to-one',
            )}
          >
            {(focused
              ? [focused, ...characters.filter((character) => character.id !== focused.id)]
              : characters
            ).map((character, index) => (
              <CharacterTile
                key={character.id}
                character={character}
                variant={
                  focused
                    ? character.id === focused.id
                      ? 'focus'
                      : 'small'
                    : index === 0
                      ? 'grid'
                      : 'quiet'
                }
                focus={focused?.id === character.id}
                active={!quietMode && ((chatOpen && character.id === selected.id) || (index === 0 && reaction > 1))}
                status={
                  quietMode
                    ? '공부 중'
                    : chatOpen && character.id === selected.id
                      ? '채팅 중'
                      : index === 0 && reaction
                        ? reaction === 1
                          ? '힐끔'
                          : '말 거는 중'
                        : '공부 중'
                }
                speech={
                  quietMode
                    ? undefined
                    : character.id === selected.id && chatOpen
                      ? undefined
                      : index === 0
                        ? customSpeech || reactions[reaction]
                        : index === 1 && reaction
                          ? '…'
                          : undefined
                }
                interactionMode={interactionMode}
                chatting={chatOpen && character.id === selected.id}
                onActivate={() => activateFriend(character.id)}
                onDismiss={
                  index === 0 && reaction > 1 && !chatOpen && !quietMode
                    ? () => {
                        setReaction(0)
                        setCustomSpeech('아, 필기 중이었구나. 미안!')
                      }
                    : undefined
                }
              />
            ))}
            {selfTile(!!focused)}
          </div>
          {dock()}
          {active.runningSince === null && (
            <div role="status" className="pause-label">
              잠깐 쉬어도 괜찮아요 · 일시정지 중
            </div>
          )}
        </div>
      ) : (
          <div className="break-stage">
            <CharacterTile
              character={selected}
              variant="rest"
              status="쉬는 중"
              speech={chatOpen ? undefined : lastReply?.text ?? '그럼 조금만 더 쉬어. 내가 시간 봐 줄게.'}
            >
              <div className="break-thumbnails">
                {characters
                  .filter((character) => character.id !== selected.id)
                  .map((character) => (
                    <button
                      key={character.id}
                      onClick={() => selectFriend(character.id)}
                      className="break-thumbnail"
                    >
                      <img
                        src={getCharacterArtwork(character.id).affection}
                        alt=""
                        className="size-full object-cover"
                      />
                      <span className="tile-label">{character.name} · 쉬는 중</span>
                    </button>
                  ))}
                <div className="break-thumbnail bg-[#26242e]" aria-label={cameraVisible ? '내 카메라' : '내 아바타'}>
                  <StudySelfView stream={devices.camera.stream} showCamera={cameraVisible} avatar={state.profile.avatar} small />
                </div>
              </div>
              <div className="break-actions">
                <button className="bg-brand-solid text-white" onClick={() => finish(true)}>
                  목표 정하고 공부 이어가기
                </button>
                <button className="bg-panel" onClick={() => finish()}>
                  오늘은 여기까지
                </button>
              </div>
              {remaining === 0 && (
                <div className="break-finished">
                  <h2 className="text-2xl font-bold">잘 쉬었나요?</h2>
                  <p className="mt-2 text-sm text-muted">목표를 새로 정할까요, 오늘은 마칠까요?</p>
                </div>
              )}
            </CharacterTile>
            {dock(true)}
            <div className="break-device-feedback">
              {devices.camera.error && <p role="alert" className="break-device-error">{devices.camera.error}</p>}
              {devices.microphone.error && <p role="alert" className="break-device-error">{devices.microphone.error}</p>}
            </div>
          </div>
      )}
          <SessionChatPanel
            open={chatOpen}
            onClose={closeChat}
            characters={characters}
            selected={selected}
            onSelect={selectFriend}
            onSend={send}
            replyMode={replyMode}
            onReplyModeChange={setReplyMode}
            replyPending={!!pendingReplies[selected.id]}
            replyError={replyErrors[selected.id]}
            used={used}
            now={now}
          />
      </div>
      <Dialog
        open={params.get('resume') === '1'}
        onClose={() => navigate('/')}
        closeLabel="홈으로 돌아가기"
        title="다시 공부를 시작할까요?"
      >
        <p className="mb-5 text-sm leading-6 text-muted">
          {room.name}에서 {active.phase === 'study' ? '하던 공부를' : '쉬는 시간을'} 이어서 진행해요.
          준비되면 시작해 주세요.
        </p>
        <Button className="w-full" onClick={resumeStudy}>
          <Icon name="play" size={17} /> 이어서 시작할게
        </Button>
      </Dialog>
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="공부를 마치시겠습니까?">
        <p className="mb-5 text-sm leading-6 text-muted">
          지금까지 공부한 기록을 저장하고 리포트로 이동해요.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => { setLeaveOpen(false); finish() }}>응, 여기까지 할게</Button>
          <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
            아니, 더 할거야
          </Button>
        </div>
      </Dialog>
    </main>
  )
}
