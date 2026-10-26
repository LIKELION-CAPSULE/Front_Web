import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { useDemo } from '@/features/demo/demo-context'
import { isTier } from '@/features/demo/catalog'
import { tierCost } from '@/features/demo/reducer'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { TierSelector } from '@/features/session/components/TierSelector'
import { useNow } from '@/features/session/use-now'
import { MemoryEditor } from '@/features/characters/components/MemoryEditor'
import { number } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { DemoNotice } from '@/shared/ui/DemoNotice'
import NotFoundPage from './NotFoundPage'

export default function PreparePage() {
  const { roomId } = useParams()
  const { state, dispatch } = useDemo()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const initialTier = params.get('tier')
  const [tier, setTier] = useState(isTier(initialTier) ? initialTier : 'standard')
  const [memoryOpen, setMemoryOpen] = useState(false)
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
  const setStep = params.get('step') === 'set'
  const cost = tierCost(state, tier, now)
  const returnTo = `/rooms/${room.id}/prepare?step=set&tier=${tier}`
  const hasExamPrompt = !state.examPromptedRooms.includes(room.id)
  function cameraNext(enabled: boolean) {
    dispatch({ type: 'CAMERA', enabled })
    setParams({ step: 'set' })
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
      camera,
    })
    navigate(`/study/session-${startedAt}`)
  }
  return (
    <OverlayPage backTo={`/rooms/${room.id}`} className={setStep ? 'sm:py-9' : undefined}>
      <p className="text-sm text-muted">
        {room.name} · {room.characters.map((character) => character.name).join(' · ')}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] leading-10 font-bold">
          {setStep ? '이번 세트를 골라요' : '공부 시작 전에 확인해요'}
        </h1>
        <Badge>{setStep ? '2 / 2 · 매 세트' : '1 / 2 · 처음 한 번만'}</Badge>
      </div>
      {!setStep ? (
        <>
          <div className="my-7 grid items-center gap-[22px] sm:grid-cols-[240px_1fr]">
            <div className="camera-check-preview flex h-[170px] items-center justify-center overflow-hidden rounded-[16px] bg-placeholder">
              <AvatarIllustration settings={state.profile.avatar} />
            </div>
            <div>
              <p className="flex items-center gap-2 text-[17px] font-bold">
                <Icon name="check" className="text-emerald-300" />
                얼굴이 잘 보여요 · 샘플
              </p>
              <p className="mt-3 text-[15px] leading-6 text-muted">
                카메라 영상은 저장하지 않아요. 내 캠은 화면 속 내 칸에만 보여요.
              </p>
              <p className="mt-2 text-xs leading-5 text-subtle">
                지금은 샘플 화면이에요. 실제 카메라 권한을 요청하거나 촬영하지 않아요.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_3fr]">
            <Button variant="secondary" onClick={() => cameraNext(false)}>
              카메라 없이 다음
            </Button>
            <Button onClick={() => cameraNext(true)}>다음 · 세트와 등급 고르기</Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-[14px] bg-surface px-4 py-3 text-[15px]">
            <Icon name="camera" size={18} className="text-brand" />
            <span>
              카메라 · {state.cameraEnabled ? '지난 설정 그대로 켜요' : '카메라 없이 공부해요'}
            </span>
            <button onClick={() => setParams({})} className="text-sm text-brand-strong underline">
              다시 점검
            </button>
          </div>
          {hasExamPrompt && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-brand-line px-4 py-2">
              <strong className="text-[15px]">시험이 있나요?</strong>
              <span className="flex-1 text-xs text-muted">
                기억해서 응원해 줘요 · 이 룸 첫 시작 때만
              </span>
              <button
                onClick={() => setMemoryOpen(true)}
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-brand-strong"
              >
                + 일정 추가
              </button>
              <button
                className="text-xs text-subtle"
                onClick={() => dispatch({ type: 'EXAM_PROMPTED', roomId: room.id })}
              >
                없어요
              </button>
            </div>
          )}
          <p className="mt-5 text-[15px]">
            <strong>공부 세트</strong>
            <span className="text-muted"> · 50분 공부 + 10분 쉬는 시간</span>
          </p>
          <div className="mt-2 flex overflow-hidden rounded-control text-sm font-bold">
            <div className="flex-1 bg-brand-solid px-4 py-3 text-white">
              공부 50분 · 캐릭터도 같이 공부
            </div>
            <div className="bg-brand-soft px-4 py-3 text-brand-strong">휴식 10분</div>
          </div>
          <div className="mt-5 mb-2 flex flex-wrap items-baseline gap-3">
            <h2 className="text-[15px] font-bold">이번 세트 등급</h2>
            <p className="text-xs text-subtle">
              공부 중 딴짓 반응은 모든 등급 동일 · 보유 {number(state.credits)} 크레딧
            </p>
          </div>
          <TierSelector
            value={tier}
            onChange={(value) => {
              setTier(value)
              setError('')
            }}
          />
          {state.pass && (
            <p className="mt-3 text-sm text-brand-strong">
              {state.pass.name} 이용 중 ·{' '}
              {cost === 0 && tier !== 'basic'
                ? '이번 세트는 패스로 이용해요.'
                : '등급별 이용 조건을 확인해 주세요.'}
            </p>
          )}
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <DemoNotice compact />
            <Link
              to={`/credits/charge?returnTo=${encodeURIComponent(returnTo)}`}
              className="text-xs text-brand-strong underline"
            >
              충전 · 패스 보기 →
            </Link>
          </div>
        </>
      )}
      {!setStep && <DemoNotice />}
      {memoryOpen && (
        <MemoryEditor
          characterId={room.characters[0]!.id}
          onClose={() => setMemoryOpen(false)}
          onSaved={() => dispatch({ type: 'EXAM_PROMPTED', roomId: room.id })}
        />
      )}
    </OverlayPage>
  )
}
