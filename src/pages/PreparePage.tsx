import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ApiError } from '@/shared/api/client'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { getRoomPoster } from '@/features/rooms/room-poster'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import AccountSettingsDialog from '@/features/profile/components/AccountSettingsDialog'
import { TierSelector } from '@/features/session/components/TierSelector'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { PrepareDialog } from '@/features/session/components/PrepareDialog'
import type { PrepareDepartureHandle } from '@/features/session/components/PrepareDeparture'
import { prepareBackground } from '@/features/session/prepare-location'
import { Icon } from '@/shared/ui/Icon'
import NotFoundPage from './NotFoundPage'
import MvpUnavailablePage from './MvpUnavailablePage'
import { MvpGate } from '@/features/mvp/MvpGate'
import { isMvpRoom, MVP_GOAL_MINUTES } from '@/features/mvp/policy'
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
  const scheduleSection = useRef<HTMLElement>(null)
  const [goalMinutes, setGoalMinutes] = useState(MVP_GOAL_MINUTES)
  const goalHintId = useId()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const room = getStudyRoom(roomId ?? '')
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
  function closeSchedule() {
    setScheduleOpen(false)
    requestAnimationFrame(() => scheduleSection.current?.querySelector('button')?.focus({ preventScroll: true }))
  }
  if (!room)
    return (
      <Dialog open title="공부 준비" onClose={close} className="prepare-dialog">
        <NotFoundPage />
      </Dialog>
    )
  if (!room.serverRoom && !isMvpRoom(room.id)) return <Dialog open title="공부 준비" onClose={close} className="prepare-dialog"><MvpUnavailablePage /></Dialog>
  // The server can finish before the plan has entered the capsule.
  if (state.activeSession && !starting) return <Navigate to={`/study/${state.activeSession.id}`} replace />

  async function start() {
    if (startInFlight.current || !room?.characters[0]) return
    startInFlight.current = true
    setStarting(true); setError('')
    let departing = false
    try {
      if (backend.activeSummary?.sessionId) { navigate(`/study/${backend.activeSummary.sessionId}?resume=1`, { replace: true }); return }
      const nextScreen = loadStudyPage()
      const animation = departure.current?.play({
        nickname: state.profile.name, targetMinutes: MVP_GOAL_MINUTES,
        characterName: room.characters[0].name, createdAt: Date.now(),
        posterUrl: getRoomPoster(room),
      }) ?? Promise.resolve()
      const [session] = await Promise.all([backend.startSession(room.id, room.characters[0].id, MVP_GOAL_MINUTES), animation, nextScreen])
      if (!mounted.current) return
      departing = true
      const enterStudy = () => navigate(`/study/${session.id}`, { replace: true })
      if (departure.current) await departure.current.depart(enterStudy)
      else enterStudy()
    } catch (reason) {
      departing = false
      if (!mounted.current) return
      departure.current?.reset()
      if (reason instanceof ApiError && reason.code === 'SESSION_ALREADY_IN_PROGRESS' && typeof reason.detail.sessionId === 'number') {
        try {
          await backend.reload()
          if (mounted.current) navigate(`/study/${reason.detail.sessionId}?resume=1`, { replace: true })
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
          조절값 {goalMinutes}분 · 시연 목표는 {MVP_GOAL_MINUTES}분으로 고정.
        </p>
      </div>
      <section ref={scheduleSection} aria-label="목표 시간과 일정" className="mt-5 rounded-card bg-panel p-5">
        <StudyGoalPicker
          value={goalMinutes}
          onChange={setGoalMinutes}
          descriptionId={goalHintId}
          className="m-0 min-w-0 rounded-none border-0 bg-transparent p-0"
          headerAction={
            <Button size="sm" variant="secondary" disabled={starting} aria-haspopup="dialog" className="whitespace-nowrap px-3" onClick={() => setScheduleOpen(true)}>
              <Icon name="calendar" size={16} /> 일정 추가
            </Button>
          }
        />
      </section>
      <section aria-labelledby="prepare-conversation-title" className="mt-6">
        <h2 id="prepare-conversation-title" className="mb-3 type-section-title">대화 옵션</h2>
        <MvpGate label="대화 옵션" className="rounded-card">
          <TierSelector value="basic" onChange={() => {}} />
        </MvpGate>
      </section>
      {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
      <Button data-prepare-start className="mt-5 w-full" loading={starting} onClick={() => { void start() }}>시작하기</Button>
      {scheduleOpen && <AccountSettingsDialog
        initialView="schedule"
        openScheduleEditor
        onClose={closeSchedule}
      />}
    </PrepareDialog>
  )
}
