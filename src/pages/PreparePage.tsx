import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ApiError } from '@/shared/api/client'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import { MemoryEditor } from '@/features/schedule/components/MemoryEditor'
import { TierSelector } from '@/features/session/components/TierSelector'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { Button } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { Icon } from '@/shared/ui/Icon'
import NotFoundPage from './NotFoundPage'
import MvpUnavailablePage from './MvpUnavailablePage'
import { MvpGate } from '@/features/mvp/MvpGate'
import { isMvpRoom, MVP_GOAL_MINUTES } from '@/features/mvp/policy'

export default function PreparePage() {
  const { roomId } = useParams()
  const { state } = useDemo()
  const backend = useBackend()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()
  const [goalMinutes, setGoalMinutes] = useState(MVP_GOAL_MINUTES)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const room = getStudyRoom(roomId ?? '')
  if (!room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  if (!room.serverRoom && !isMvpRoom(room.id)) return <OverlayPage><MvpUnavailablePage /></OverlayPage>
  if (state.activeSession) return <Navigate to={`/study/${state.activeSession.id}`} replace />

  async function start() {
    if (starting || !room?.characters[0]) return
    setStarting(true); setError('')
    try {
      if (backend.activeSummary?.sessionId) { navigate(`/study/${backend.activeSummary.sessionId}?resume=1`); return }
      const session = await backend.startSession(room.id, room.characters[0].id, MVP_GOAL_MINUTES)
      navigate(`/study/${session.id}`)
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'SESSION_ALREADY_IN_PROGRESS' && typeof reason.detail.sessionId === 'number') {
        await backend.reload()
        navigate(`/study/${reason.detail.sessionId}?resume=1`)
      } else setError(reason instanceof Error ? reason.message : '공부를 시작하지 못했어요.')
    }
    finally { setStarting(false) }
  }

  return (
    <OverlayPage
      backTo={`/rooms/${room.id}`}
      headerClassName="mb-0"
      headerAside={(
        <div className="prepare-room-context flex max-w-[420px] flex-col items-end gap-2 text-right">
          <p className="text-caption leading-5 break-keep text-muted">{room.name}</p>
          <RoomCompanions characters={room.characters} className="justify-end" />
        </div>
      )}
      className="sm:py-9"
    >
      <h1 className="min-w-0 break-keep type-page-title">목표 시간을 정해요</h1>
      <section aria-labelledby="prepare-schedule-title" className="mt-5 flex items-center justify-between gap-3 rounded-control bg-panel p-4">
        <h2 id="prepare-schedule-title" className="type-section-title">일정</h2>
        <Button size="sm" variant="secondary" aria-haspopup="dialog" onClick={() => setScheduleOpen(true)}>
          <Icon name="calendar" size={16} /> 일정 추가
        </Button>
      </section>
      <h2 className="mt-5 mb-3 type-section-title">대화 옵션</h2>
      <MvpGate label="대화 옵션" className="rounded-card">
        <TierSelector value="basic" onChange={() => {}} />
      </MvpGate>
      <StudyGoalPicker value={goalMinutes} onChange={setGoalMinutes} />
      {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
      <Button className="mt-5 w-full" disabled={starting} onClick={() => { void start() }}>{starting ? '시작하고 있어요…' : '시작하기'}</Button>
      {scheduleOpen && <MemoryEditor
        onClose={() => setScheduleOpen(false)}
      />}
    </OverlayPage>
  )
}
