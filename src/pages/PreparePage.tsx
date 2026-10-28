import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { useDemo } from '@/features/demo/demo-context'
import { isTier } from '@/features/demo/catalog'
import { tierCost } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { RoomCompanions } from '@/features/rooms/components/RoomCompanions'
import { TierSelector } from '@/features/session/components/TierSelector'
import { useNow } from '@/features/session/use-now'
import { StudyGoalPicker } from '@/features/session/components/StudyGoalPicker'
import { normalizeGoalMinutes } from '@/features/session/study-goal'
import { dayKey, number } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import NotFoundPage from './NotFoundPage'

export default function PreparePage() {
  const { roomId } = useParams()
  const { state, dispatch } = useDemo()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const initialTier = params.get('tier')
  const [tier, setTier] = useState(isTier(initialTier) ? initialTier : 'standard')
  const [goalMinutes, setGoalMinutes] = useState(() =>
    normalizeGoalMinutes(Number(params.get('goal') ?? 50)),
  )
  const [error, setError] = useState('')
  const now = useNow()
  const room = getStudyRoom(roomId ?? '')
  if (!room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  if (state.activeSession) return <Navigate to={`/study/${state.activeSession.id}`} replace />
  const goalStep = params.get('step') === 'goal' || params.get('step') === 'set'
  const cost = tierCost(state, tier, now)
  const returnTo = `/rooms/${room.id}/prepare?step=goal&tier=${tier}&goal=${goalMinutes}`
  const hasExamPrompt =
    !state.memories.some((memory) => memory.kind === '시험' && memory.date >= dayKey(now)) &&
    !state.examPromptedRooms.includes(room.id)
  function cameraNext(enabled: boolean) {
    dispatch({ type: 'CAMERA', enabled })
    setParams({ step: 'goal', goal: String(goalMinutes), tier })
  }
  function start(camera: boolean, startedAt: number) {
    if (cost > state.credits) {
      setError('크레딧이 부족해요. 베이직으로 시작하거나 충전해 주세요.')
      return
    }
    dispatch({
      type: 'START',
      now: startedAt,
      roomId: room!.id,
      characterIds: room!.characters.map((character) => character.id),
      tier,
      targetMinutes: goalMinutes,
      camera,
    })
    navigate(`/study/session-${startedAt}`)
  }
  return (
    <OverlayPage backTo={`/rooms/${room.id}`} className={goalStep ? 'sm:py-9' : undefined}>
      <header className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-sm text-muted">{room.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] leading-10 font-bold">
              {goalStep ? '목표 시간을 정해요' : '공부 시작 전에 확인해요'}
            </h1>
            <Badge>{goalStep ? '2 / 2 · 공부 설정' : '1 / 2 · 처음 한 번만'}</Badge>
          </div>
        </div>
        <RoomCompanions characters={room.characters} className="order-first justify-self-end sm:order-none" />
      </header>
      {!goalStep ? (
        <>
          <div className="my-7 grid items-center gap-[22px] sm:grid-cols-[240px_1fr]">
            <div className="camera-check-preview flex h-[170px] items-center justify-center overflow-hidden rounded-[16px] bg-placeholder">
              <AvatarIllustration settings={state.profile.avatar} />
            </div>
            <div>
              <p className="flex items-center gap-2 text-[17px] font-bold">
                <Icon name="check" className="text-emerald-300" />
                카메라 미리보기
              </p>
              <p className="mt-3 text-[15px] leading-6 text-muted">
                영상은 저장하지 않으며, 내 자리에만 보여요.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
            <Button variant="secondary" onClick={() => cameraNext(false)}>
              카메라 없이 다음
            </Button>
            <Button onClick={() => cameraNext(true)}>다음 · 목표 시간 정하기</Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-[14px] bg-surface px-4 py-3 text-[15px]">
            <Icon name="camera" size={18} className="text-brand" />
            <span>카메라</span>
            <button
              onClick={() => setParams({ goal: String(goalMinutes), tier })}
              className="text-sm text-brand-strong underline"
            >
              다시 확인
            </button>
          </div>
          {hasExamPrompt && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-transparent px-4 py-2">
              <strong className="text-[15px]">시험이 있나요?</strong>
              <span className="flex-1 text-xs text-muted">
                모든 친구가 함께 기억하고 응원해 줘요
              </span>
              <Link
                to={`/mypage?add=1&fromRoom=${room.id}&next=${encodeURIComponent(returnTo)}#schedule`}
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-brand-strong"
              >
                + 일정 추가
              </Link>
              <button
                className="text-xs text-subtle"
                onClick={() => dispatch({ type: 'EXAM_PROMPTED', roomId: room.id })}
              >
                없어요
              </button>
            </div>
          )}
          <StudyGoalPicker value={goalMinutes} onChange={setGoalMinutes} />
          <div className="mt-5 mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-[15px] leading-6 font-bold">대화 옵션</h2>
              {state.pass && (
                <span className="text-xs leading-6 text-brand-strong">
                  {state.pass.name} 이용 중
                </span>
              )}
            </div>
            <p className="text-xs leading-6 whitespace-nowrap text-muted">
              {number(state.credits)} 크레딧
            </p>
          </div>
          <TierSelector
            value={tier}
            onChange={(value) => {
              setTier(value)
              setError('')
            }}
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-brand-strong">
              {error}{' '}
              <Link
                className="underline"
                to={`/credits/charge?returnTo=${encodeURIComponent(returnTo)}`}
              >
                충전하기
              </Link>
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_3fr]">
            <Button variant="secondary" onClick={() => start(false, Date.now())}>
              카메라 없이 시작
            </Button>
            <Button onClick={() => start(state.cameraEnabled, Date.now())}>
              시작하기 · {number(cost)} 크레딧
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/credits/charge?returnTo=${encodeURIComponent(returnTo)}`}
              className="text-xs text-brand-strong underline"
            >
              크레딧 · 패스 보기
            </Link>
          </div>
        </>
      )}
    </OverlayPage>
  )
}
