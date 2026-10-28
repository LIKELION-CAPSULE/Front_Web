import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { tierById } from '@/features/demo/catalog'
import { BREAK_SECONDS, sessionElapsed } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { studyGoalSeconds } from '@/features/session/study-goal'
import { useNow } from '@/features/session/use-now'
import { CharacterTile } from '@/features/session/components/CharacterTile'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import { ChatComposer } from '@/features/session/components/ChatComposer'
import { BreakConversation } from '@/features/session/components/BreakConversation'
import { sessionAssets } from '@/features/session/assets'
import { businessDay, clock } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { EmptyState } from '@/shared/ui/EmptyState'

const reactions = ['', '…', '야, 폰 보는 거 다 보여.', '…나랑 공부하기 싫어?']

export default function StudyPage() {
  const { state, dispatch } = useDemo()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState('')
  const [reaction, setReaction] = useState(2)
  const [customSpeech, setCustomSpeech] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [quietMode, setQuietMode] = useState(false)
  const now = useNow()
  const active = state.activeSession
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
  const selected = characters.find((character) => character.id === selectedId) ?? characters[0]!
  const focusId = params.get('focus')
  const focused = characters.find((character) => character.id === focusId)
  const chatOpen = params.get('chat') === '1'
  const elapsed = sessionElapsed(active, now)
  const goal = studyGoalSeconds(active)
  const remaining = Math.max(0, (active.phase === 'study' ? goal : BREAK_SECONDS) - elapsed)
  const used = state.chatUsage.day === businessDay(now) ? state.chatUsage.used : 0
  const messages = state.messages.filter(
    (message) => message.sessionId === active.id && message.characterId === selected.id,
  )
  const lastReply = messages.filter((message) => message.sender === 'character').at(-1)
  function focus(id?: string) {
    if (id) setSelectedId(id)
    const next = new URLSearchParams(params)
    if (id) next.set('focus', id)
    else next.delete('focus')
    setParams(next)
  }
  function toggleChat() {
    if (!chatOpen) setQuietMode(false)
    const next = new URLSearchParams(params)
    if (chatOpen) next.delete('chat')
    else next.set('chat', '1')
    setParams(next)
  }
  function send(text: string, voice = false) {
    if (active!.tier === 'basic' && used >= 3) {
      setUpgradeOpen(true)
      return
    }
    dispatch({ type: 'MESSAGE', characterId: selected.id, name: selected.name, text, voice, now })
    if (active!.tier === 'basic' && used >= 2) setUpgradeOpen(true)
    setCustomSpeech('')
  }
  function finish(another = false) {
    dispatch({ type: 'FINISH', now: Date.now() })
    navigate(
      another
        ? `/rooms/${room!.id}/prepare?step=goal&goal=${Math.round(studyGoalSeconds(active!) / 60)}`
        : `/reports/${active!.id}`,
    )
  }
  const timer = (
    <div className="session-timer">
      <strong className="font-mono text-[21px]">{clock(remaining)}</strong>
      <span className="text-[10px] text-white/75">
        목표 {Math.round(goal / 60)}분 · 끝나면 10분 휴식
      </span>
      <Badge className="bg-brand-soft text-brand-strong">{tierById(active.tier).name}</Badge>
    </div>
  )
  function selfTile(small = false) {
    return (
      <article aria-label="내 칸" className="self-tile">
        {!focused && active!.phase === 'study' && timer}
        <div className="self-status">
          <img src={reaction > 0 ? sessionAssets.purpleDot : sessionAssets.greenDot} alt="" />
          <span>{active!.camera ? '카메라 켜짐' : '카메라 꺼짐'}</span>
        </div>
        <div
          className={cn(
            'self-avatar-scene',
            small && 'is-small',
            active!.camera && 'camera-enabled',
          )}
        >
          <AvatarIllustration settings={state.profile.avatar} />
          <p>{active!.camera ? '카메라 미리보기' : '이곳이 나의 자리'}</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'CAMERA', enabled: !active!.camera })}
          className="absolute bottom-3 left-3 rounded-full bg-brand/85 px-3 py-1 text-xs text-white"
        >
          카메라 {active!.camera ? '끄기' : '켜기'}
        </button>
        <span className="absolute right-3 bottom-3 rounded-full bg-brand/85 px-3 py-1 text-xs text-white">
          나 · {state.profile.name}
        </span>
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
        <Link to="/" aria-label="CAPSULE 홈">
          <Brand />
        </Link>
        <span className="study-room-name">{room.name}</span>
        <span className="study-phase-label">
          <span className="live-dot" />
          {active.phase === 'study' ? '지금은 집중하는 시간' : '잠깐, 쉬어가는 시간'}
        </span>
        {active.phase === 'study' && (
          <button
            type="button"
            aria-pressed={quietMode}
            onClick={() => {
              setQuietMode(!quietMode)
              if (!quietMode && chatOpen) toggleChat()
            }}
            className="quiet-mode-toggle"
          >
            <Icon name="moon" size={14} />
            조용히 집중
          </button>
        )}
        <span className="ml-auto hidden items-center gap-2 text-xs text-muted sm:flex">
          <Icon name="headphones" size={15} />
          각자의 목표, 같은 시간
        </span>
      </header>
      {active.phase === 'study' ? (
        <>
          <div
            className={cn(
              'study-grid',
              focused && 'is-focus',
              characters.length === 1 && !focused && 'is-one-to-one',
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
                active={!quietMode && index === 0 && (reaction > 1 || chatOpen)}
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
                      ? (lastReply?.text ?? '나도 졸려. 5분만 더 버티고 쉬자.')
                      : index === 0
                        ? customSpeech || reactions[reaction]
                        : index === 1 && reaction
                          ? '…'
                          : undefined
                }
                onFocus={() => focus(focused?.id === character.id ? undefined : character.id)}
                onReact={
                  chatOpen || quietMode
                    ? undefined
                    : () => {
                        setSelectedId(character.id)
                        setCustomSpeech('왔네? 오늘도 같이 해 보자.')
                        setReaction(0)
                      }
                }
                onDismiss={
                  index === 0 && reaction > 1 && !chatOpen && !quietMode
                    ? () => {
                        setReaction(0)
                        setCustomSpeech('아, 필기 중이었구나. 미안!')
                      }
                    : undefined
                }
              >
                {focused?.id === character.id && timer}
                {chatOpen && character.id === selected.id && (
                  <ChatComposer
                    compact
                    name={selected.name}
                    onSend={send}
                    disabled={active.tier === 'basic' && used >= 3}
                    remaining={active.tier === 'basic' ? used : undefined}
                  />
                )}
              </CharacterTile>
            ))}
            {selfTile(!!focused)}
          </div>
          <nav aria-label="공부 컨트롤" className="study-dock">
            <button onClick={() => dispatch({ type: 'PAUSE', now: Date.now() })}>
              <Icon name={active.runningSince === null ? 'play' : 'pause'} size={16} />
              {active.runningSince === null ? '계속하기' : '일시정지'}
            </button>
            <button
              className={cn('text-brand-strong', chatOpen && 'bg-brand-solid text-white')}
              onClick={toggleChat}
            >
              <Icon name="chat" size={16} />
              {chatOpen ? '채팅 닫기' : '채팅'}
            </button>
            <button className="bg-brand-solid text-white" onClick={() => finish()}>
              <span className="size-2.5 rounded-sm bg-current" />
              공부 끝내기
            </button>
          </nav>
          {active.runningSince === null && (
            <div role="status" className="pause-label">
              잠깐 쉬어도 괜찮아요 · 일시정지 중
            </div>
          )}
          {upgradeOpen && (
            <Dialog open onClose={() => setUpgradeOpen(false)} title="오늘 무료 대화를 모두 사용했어요" className="max-w-sm">
              <p className="text-sm leading-6 text-muted">
                쉬는 시간에 대화 옵션을 올리거나, 그대로 공부를 이어갈 수 있어요.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  size="md"
                  onClick={() => {
                    dispatch({ type: 'SKIP_TO_BREAK', now: Date.now() })
                    setUpgradeOpen(true)
                  }}
                >
                  쉬는 시간으로 이동
                </Button>
                <Button size="md" variant="secondary" onClick={() => setUpgradeOpen(false)}>
                  계속 공부하기
                </Button>
              </div>
            </Dialog>
          )}
        </>
      ) : (
        <div className="break-layout">
          <div className="relative min-h-0">
            <CharacterTile
              character={selected}
              variant="rest"
              status="쉬는 중"
              speech={lastReply?.text ?? '그럼 조금만 더 쉬어. 내가 시간 봐 줄게.'}
            >
              <div className="break-timer">
                <span className="font-bold text-brand-strong">쉬는 시간</span>
                <strong className="font-mono text-[21px]">{clock(remaining).slice(3)}</strong>
                <span className="text-xs text-muted">남음 · 이후에 다음 목표 정하기</span>
              </div>
              <div className="break-thumbnails">
                {characters
                  .filter((character) => character.id !== selected.id)
                  .map((character) => (
                    <button
                      key={character.id}
                      onClick={() => setSelectedId(character.id)}
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
                <div className="break-thumbnail bg-[#26242e]">
                  <span className="tile-label bg-brand-solid text-white">
                    나 · {state.profile.name}
                  </span>
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
          </div>
          <BreakConversation
            characters={characters}
            selected={selected}
            onSelect={setSelectedId}
            onSend={send}
            used={used}
            upgradeOpen={upgradeOpen}
            setUpgradeOpen={setUpgradeOpen}
            now={now}
          />
        </div>
      )}
      <details className={cn('demo-controls', active.phase === 'break' && 'demo-controls-break')}>
        <summary>데모 조작</summary>
        <p className="mb-2 text-[11px] text-muted">실제 감지·촬영은 하지 않아요.</p>
        <div className="flex flex-wrap gap-1.5">
          {active.phase === 'study' && (
            <>
              <button onClick={() => dispatch({ type: 'SKIP_TO_BREAK', now: Date.now() })}>
                휴식 화면 보기
              </button>
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setReaction(level)
                    setCustomSpeech('')
                  }}
                >
                  반응 {level}단계
                </button>
              ))}
              <button
                onClick={() => {
                  setReaction(0)
                  setCustomSpeech('오, 돌아왔네. 계속 가자.')
                }}
              >
                공부 복귀
              </button>
            </>
          )}
          <Link to="/">홈으로</Link>
          <ButtonLink
            to="/credits"
            variant="secondary"
            size="xs"
          >
            내 크레딧
          </ButtonLink>
        </div>
      </details>
    </main>
  )
}
