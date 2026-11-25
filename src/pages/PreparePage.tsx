import { useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ApiError } from '@/shared/api/client'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { getRoomPoster } from '@/features/rooms/room-poster'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import type { TierId } from '@/features/demo/types'
import { useNow } from '@/features/session/use-now'
import { DEFAULT_GOAL_MINUTES } from '@/features/session/study-goal'
import { tierCost } from '@/features/demo/reducer'
import { number } from '@/shared/lib/format'
import { DummyNotice } from '@/features/dummy/DummyNotice'
import { TierSelector } from '@/features/session/components/TierSelector'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { PrepareDialog } from '@/features/session/components/PrepareDialog'
import type { PrepareDepartureHandle } from '@/features/session/components/PrepareDeparture'
import { prepareBackground } from '@/features/session/prepare-location'
import { AnimatedCheckbox } from '@/shared/ui/AnimatedCheckbox'
import { Icon } from '@/shared/ui/Icon'
import NotFoundPage from './NotFoundPage'
import './prepare.css'
import { loadStudyPage } from '@/app/study-page-loader'

export default function PreparePage() {
  const { roomId } = useParams()
  const location = useLocation()
  const { state } = useDemo()
  const backend = useBackend()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const departure = useRef<PrepareDepartureHandle>(null)
  const startInFlight = useRef(false)
  const mounted = useRef(true)
  const navigate = useNavigate()
  const closing = useRef(false)
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_GOAL_MINUTES)
  const [tier, setTier] = useState<TierId>('basic')
  const [picked, setPicked] = useState<string[] | null>(null)
  const goalHintId = useId()
  const room = getStudyRoom(roomId ?? '')
  const requestedFriend = new URLSearchParams(location.search).get('friend')
  const characterIds = picked ?? [room?.characters.find(c => c.id === requestedFriend)?.id ?? room?.characters[0]?.id ?? '']
  const now = useNow()
  const cost = tierCost(state, tier, now)
  const dummySession = !room?.serverRoom || characterIds.length > 1 || characterIds.some(id => !room.characters.find(c => c.id === id)?.serverCharacter)
  useEffect(() => {
    const title = document.title
    document.title = 'CAPSULE · 공부 준비'
    return () => { document.title = title }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (!error || starting) return
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-prepare-start]')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [error, starting])
  function close() {
    if (starting || closing.current) return
    closing.current = true
    if (prepareBackground(location.state)) navigate(-1)
    else navigate(room ? `/rooms/${room.id}` : '/', { replace: true })
  }
  if (!room)
    return (
      <Dialog open title="공부 준비" onClose={close} className="prepare-dialog">
        <NotFoundPage />
      </Dialog>
    )
  // The server can finish before the plan has entered the capsule.
  if (state.activeSession && !starting) return <Navigate to={`/study/${state.activeSession.id}`} replace />

  async function start() {
    if (startInFlight.current || !room?.characters[0]) return
    startInFlight.current = true
    setStarting(true); setError('')
    let departing = false
    try {
      if (backend.activeSummary?.connectionId) { navigate(`/study/${backend.activeSummary.connectionId}?resume=1`, { replace: true }); return }
      const nextScreen = loadStudyPage()
      const animation = departure.current?.play({
        nickname: state.profile.name, targetMinutes: goalMinutes,
        characterName: room.characters.filter(c => characterIds.includes(c.id)).map(c => c.name).join(' · '), createdAt: Date.now(),
        posterUrl: getRoomPoster(room),
      }) ?? Promise.resolve()
      const [session] = await Promise.all([backend.startSession(room.id, characterIds[0]!, goalMinutes, { tier, characterIds }), animation, nextScreen])
      if (!mounted.current) return
      departing = true
      const enterStudy = () => navigate(`/study/${session.id}`, { replace: true })
      if (departure.current) await departure.current.depart(enterStudy)
      else enterStudy()
    } catch (reason) {
      departing = false
      if (!mounted.current) return
      departure.current?.reset()
      if (reason instanceof ApiError && reason.code === 'CONNECTION_ALREADY_IN_PROGRESS' && typeof reason.detail.connectionId === 'number') {
        try {
          await backend.reload()
          if (mounted.current) navigate(`/study/${reason.detail.connectionId}?resume=1`, { replace: true })
        } catch (reloadError) {
          if (mounted.current) setError(reloadError instanceof Error ? reloadError.message : '진행 중인 공부를 확인하지 못했어요.')
        }
      } else setError(reason instanceof Error ? reason.message : '공부를 시작하지 못했어요.')
    }
    // Keep the guard until unmount: browser Back can interrupt a handoff before its route update commits.
    finally { startInFlight.current = false; if (mounted.current && !departing) setStarting(false) }
  }

  return (
    <PrepareDialog open title="공부 준비" showHeader={false} onClose={close} dismissible={!starting} departureRef={departure}>
      <div className="flex items-start justify-between gap-4">
        <Button variant="ghost" size="sm" disabled={starting} onClick={close} className="prepare-back">
          <Icon name="arrow" size={16} className="rotate-180" />돌아가기
        </Button>
        <div className="prepare-room-context flex max-w-[420px] flex-col items-end gap-2 text-right">
          <p className="text-caption leading-5 break-keep text-muted">{room.name}</p>
          <RoomCompanions characters={room.characters} className="justify-end" />
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 tabIndex={-1} data-dialog-initial-focus className="min-w-0 break-keep type-page-title focus:outline-none">목표 시간을 정해요</h1>
        <p id={goalHintId} className="ml-auto text-right text-caption text-subtle">
          선택한 {goalMinutes}분이 공부 목표에 반영돼요.
        </p>
      </div>
      <section aria-label="목표 시간" className="mt-5 rounded-card bg-panel p-5">
        <StudyGoalPicker
          disabled={starting}
          value={goalMinutes}
          onChange={setGoalMinutes}
          descriptionId={goalHintId}
          className="m-0 min-w-0 rounded-none border-0 bg-transparent p-0"
        />
      </section>
      {room.characters.length > 1 && <fieldset disabled={starting} className="mt-5">
        <legend className="mb-2 type-section-title">함께할 친구</legend>
        <div className="flex flex-wrap gap-3">{room.characters.map(character => <label key={character.id} className="flex items-center gap-2 rounded-control bg-panel px-3 py-2">
          <AnimatedCheckbox checked={characterIds.includes(character.id)} onChange={() => setPicked(characterIds.includes(character.id) ? characterIds.filter(id => id !== character.id) : [...characterIds, character.id])} />{character.name}
        </label>)}</div>
      </fieldset>}
      {(dummySession || tier !== 'basic') && <DummyNotice>{dummySession ? '이 친구 구성의 공부·대화·리포트는 이 브라우저에서 체험용으로 저장돼요. ' : ''}대화 등급·크레딧은 체험용이에요. 등급별 AI·보이스 차이는 아직 적용되지 않아요.</DummyNotice>}
      <section aria-labelledby="prepare-conversation-title" className="mt-6">
        <h2 id="prepare-conversation-title" className="mb-3 type-section-title">대화 옵션</h2>
        <fieldset disabled={starting} className="m-0 border-0 p-0"><TierSelector value={tier} onChange={setTier} /></fieldset>
        <p className="mt-3 text-caption text-muted">체험용 크레딧 {number(state.credits)} · 이번 사용 {number(cost)}</p>
        {cost > state.credits && <FeedbackMessage tone="warning">체험용 크레딧이 부족해요. <Link to={`/credits/charge?returnTo=${encodeURIComponent(location.pathname + location.search)}`} className="underline">충전하기</Link></FeedbackMessage>}
      </section>
      {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
      <Button data-prepare-start disabled={!characterIds.length || cost > state.credits} className="mt-5 w-full" loading={starting} onClick={() => { void start() }}>시작하기</Button>
    </PrepareDialog>
  )
}
