import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { isTier } from '@/features/demo/catalog'
import { tierCost } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import { MemoryEditor } from '@/features/schedule/components/MemoryEditor'
import { TierSelector } from '@/features/session/components/TierSelector'
import { useNow } from '@/features/session/use-now'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { normalizeGoalMinutes } from '@/features/session/study-goal'
import { number } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import NotFoundPage from './NotFoundPage'

export default function PreparePage() {
  const { roomId } = useParams()
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialTier = params.get('tier')
  const [tier, setTier] = useState(isTier(initialTier) ? initialTier : 'standard')
  const [goalMinutes, setGoalMinutes] = useState(() =>
    normalizeGoalMinutes(Number(params.get('goal') ?? 50)),
  )
  const [error, setError] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const starting = useRef(false)
  const now = useNow()
  const room = getStudyRoom(roomId ?? '')
  if (!room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  if (state.activeSession) return <Navigate to={`/study/${state.activeSession.id}`} replace />
  const cost = tierCost(state, tier, now)
  const activePass = state.pass && state.pass.expiresAt > now ? state.pass : null
  const returnTo = `/rooms/${room.id}/prepare?tier=${tier}&goal=${goalMinutes}`

  function start() {
    if (starting.current) return
    if (cost > state.credits) {
      setError('크레딧이 부족해요. 베이직으로 시작하거나 충전해 주세요.')
      return
    }
    starting.current = true
    const startedAt = Date.now()
    dispatch({
      type: 'START',
      now: startedAt,
      roomId: room!.id,
      characterIds: room!.characters.map((character) => character.id),
      tier,
      targetMinutes: goalMinutes,
      // Device access is requested only by the study screen's controls.
      camera: false,
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
      <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-section-title">대화 옵션</h2>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-caption leading-6">
          <div className="flex gap-1.5">
            <dt className="text-muted">보유 크레딧</dt>
            <dd className="font-semibold">{number(state.credits)}</dd>
          </div>
          <div className="flex gap-1.5 border-l border-divider pl-4">
            <dt className="text-muted">이용 중인 패스</dt>
            <dd className={cn('font-semibold', activePass ? 'text-text-accent' : 'text-muted')}>
              {activePass ? activePass.name : '없음'}
            </dd>
          </div>
        </dl>
      </div>
      <TierSelector
        value={tier}
        onChange={(value) => {
          setTier(value)
          setError('')
        }}
      />
      <StudyGoalPicker value={goalMinutes} onChange={setGoalMinutes} />
      <Button className="mt-5 w-full" onClick={start}>시작하기</Button>
      {error && (
        <FeedbackMessage tone="warning" align="center" className="mt-3">
          {error}{' '}
          <Link className="text-text-accent underline" to={`/credits/charge?returnTo=${encodeURIComponent(returnTo)}`}>
            충전하기
          </Link>
        </FeedbackMessage>
      )}
      {scheduleOpen && <MemoryEditor
        onClose={() => setScheduleOpen(false)}
      />}
    </OverlayPage>
  )
}
