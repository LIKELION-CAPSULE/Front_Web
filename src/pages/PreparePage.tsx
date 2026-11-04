import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import { MemoryEditor } from '@/features/schedule/components/MemoryEditor'
import { TierSelector } from '@/features/session/components/TierSelector'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { Button } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import NotFoundPage from './NotFoundPage'
import MvpUnavailablePage from './MvpUnavailablePage'
import { MvpGate } from '@/features/mvp/MvpGate'
import { isMvpRoom, MVP_GOAL_MINUTES } from '@/features/mvp/policy'

export default function PreparePage() {
  const { roomId } = useParams()
  const { state, dispatch } = useDemo()
  const navigate = useNavigate()
  const [goalMinutes, setGoalMinutes] = useState(MVP_GOAL_MINUTES)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const starting = useRef(false)
  const room = getStudyRoom(roomId ?? '')
  if (!room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  if (!isMvpRoom(room.id)) return <OverlayPage><MvpUnavailablePage /></OverlayPage>
  if (state.activeSession) return <Navigate to={`/study/${state.activeSession.id}`} replace />

  function start() {
    if (starting.current) return
    starting.current = true
    const startedAt = Date.now()
    dispatch({
      type: 'START_MVP',
      now: startedAt,
    })
    navigate(`/study/session-${startedAt}`)
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
          + 일정 추가
        </Button>
      </section>
      <h2 className="mt-5 mb-3 type-section-title">대화 옵션</h2>
      <MvpGate label="대화 옵션" className="rounded-card">
        <TierSelector value="basic" onChange={() => {}} />
      </MvpGate>
      <StudyGoalPicker value={goalMinutes} onChange={setGoalMinutes} />
      <Button className="mt-5 w-full" onClick={start}>시작하기</Button>
      {scheduleOpen && <MemoryEditor
        onClose={() => setScheduleOpen(false)}
      />}
    </OverlayPage>
  )
}
