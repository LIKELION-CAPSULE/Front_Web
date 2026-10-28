import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { DeviceCheck } from '@/features/media/components/DeviceCheck'
import { DevicePrivacyInfo } from '@/features/media/components/DevicePrivacyInfo'
import { useMedia } from '@/features/media/media-context'
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
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
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
  const [starting, setStarting] = useState(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const { devices, controller, vision, observation } = useMedia()
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
  const activePass = state.pass && state.pass.expiresAt > now ? state.pass : null
  const deviceStepPath = `/rooms/${room.id}/prepare?${new URLSearchParams({ goal: String(goalMinutes), tier })}`
  const returnTo = `/rooms/${room.id}/prepare?step=goal&tier=${tier}&goal=${goalMinutes}`
  const hasExamPrompt =
    !state.memories.some((memory) => memory.kind === '시험' && memory.date >= dayKey(now)) &&
    !state.examPromptedRooms.includes(room.id)
  function cameraNext(enabled: boolean) {
    if (!enabled) controller.stop()
    dispatch({ type: 'CAMERA', enabled })
    setParams({ step: 'goal', goal: String(goalMinutes), tier })
  }
  async function start() {
    if (starting) return
    const camera = state.cameraEnabled
    if (cost > state.credits) {
      setError('크레딧이 부족해요. 베이직으로 시작하거나 충전해 주세요.')
      return
    }
    setStarting(true)
    if (camera && !devices.camera.stream) {
      await controller.requestBoth()
      if (!mounted.current) return
      if (!controller.getSnapshot().camera.stream) {
        setStarting(false)
        setParams({ goal: String(goalMinutes), tier })
        return
      }
    }
    if (!camera) controller.stop()
    const startedAt = Date.now()
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
    <OverlayPage
      backTo={goalStep ? deviceStepPath : `/rooms/${room.id}`}
      headerClassName="mb-0"
      headerAside={(
        <div className="prepare-room-context flex max-w-[420px] flex-col items-end gap-2 text-right">
          <p className="text-xs leading-5 break-keep text-muted">{room.name}</p>
          <RoomCompanions characters={room.characters} className="justify-end" />
        </div>
      )}
      className={goalStep ? 'sm:py-9' : 'prepare-device-overlay max-w-[1040px]'}
    >
      <header>
        <div className="flex items-center gap-2.5">
          <h1 className={cn('min-w-0 text-[28px] leading-10 break-keep font-bold', !goalStep && 'sm:text-[32px]')}>
            {goalStep ? '목표 시간을 정해요' : '카메라·마이크를 확인해요'}
          </h1>
          {!goalStep && <DevicePrivacyInfo />}
        </div>
      </header>
      {!goalStep ? (
        <>
          <DeviceCheck />
          <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
            <Button variant="secondary" className="min-h-13 sm:text-base" onClick={() => cameraNext(false)}>
              카메라 없이
            </Button>
            <Button
              className="min-h-13 sm:text-base"
              disabled={!devices.camera.stream || vision?.status !== 'ready' || !observation}
              onClick={() => cameraNext(true)}
            >
              다음
            </Button>
          </div>
        </>
      ) : (
        <>
          {hasExamPrompt && (
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[14px] border border-transparent px-4 py-2">
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
          <div className="mt-5 mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] leading-6 font-bold">대화 옵션</h2>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6">
              <div className="flex gap-1.5">
                <dt className="text-muted">보유 크레딧</dt>
                <dd className="font-semibold">{number(state.credits)}</dd>
              </div>
              <div className="flex gap-1.5 border-l border-line pl-4">
                <dt className="text-muted">이용 중인 패스</dt>
                <dd className={cn('font-semibold', activePass ? 'text-brand-strong' : 'text-muted')}>
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
          <Button className="mt-5 w-full" disabled={starting} onClick={() => { void start() }}>
            {starting ? '장치를 확인하고 있어요' : '시작하기'}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-brand-strong">
              {error}{' '}
              <Link className="underline" to={`/credits/charge?returnTo=${encodeURIComponent(returnTo)}`}>
                충전하기
              </Link>
            </p>
          )}
        </>
      )}
    </OverlayPage>
  )
}
