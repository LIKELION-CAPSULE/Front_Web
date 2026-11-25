import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useServerReport } from '@/features/backend/use-server-report'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates, mateProfileByName } from '@/features/mates/catalog'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { matePortrait } from '@/features/mates/artwork'
import { focusDetectedSeconds } from '@/features/session/focus'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { CapsuleRecordCard, CapsuleRecordLayout } from '@/features/reports/components/CapsuleRecordCard'
import { recordAmountText, recordModeLabel } from '@/features/reports/capsule-record'
import { formatNextStageCaption, resolveStageProgress } from '@/features/mates/affinity-progress'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'

/** How long after the connection ends a server-stamped expression unlock still counts as this session's. */
const UNLOCK_GRACE_MS = 5 * 60_000
/** Dev preview only: what a stage-up with a newly opened expression looks like when the record has none. */
const DEV_SAMPLE_UNLOCK = { label: '수줍은 웃음', expressionFile: 'files/005.exp3.json' } as const

export default function ConnectionRecordPage() {
  const { connectionId } = useParams()
  // Arriving from the call's hang-up motion: the card plays its entrance (connections.css).
  const location = useLocation()
  const entrance = (location.state as { hangup?: boolean } | null)?.hangup ? 'hangup' : undefined
  const backend = useBackend()
  const { state } = useDemo()
  const { record, error, retry, redirectTo } = useServerReport(connectionId)
  const [modelAttempt, setModelAttempt] = useState(0)
  // Dev server only: force the level-up card (true) or the regular card (false) instead of what the record says.
  const [devLevelUp, setDevLevelUp] = useState<boolean | null>(null)
  // "▶ 보기" on a newly opened expression shows it on the mate.
  const [viewingExpression, setViewingExpression] = useState(false)

  const mates = availableMates(backend.home)
  const matchedMate = record
    ? mates.find((value) => record.characterIds.includes(value.characterId))
    : mates.length === 1
      ? mates[0]
      : undefined
  const profile = record
    ? matchedMate ?? mateProfileByName(record.characterName ?? record.serverReport?.character?.name)
    : matchedMate

  const mateId = matchedMate?.id
  const detail = mateId ? backend.mateDetails[mateId] : undefined
  const loadMateDetail = backend.loadMateDetail

  useEffect(() => {
    if (!mateId || !loadMateDetail || detail) return
    void loadMateDetail(mateId, modelAttempt > 0).catch(() => {})
  }, [mateId, loadMateDetail, detail, modelAttempt])

  if (redirectTo) {
    return (
      <Navigate
        to={state.activeSession?.mateId ? `/connect/${state.activeSession.mateId}` : redirectTo}
        replace
      />
    )
  }

  const header = (
    <SiteHeader
      sticky
      navigation={
        <nav aria-label="현재 위치" className="detail-breadcrumb">
          <Link to="/">홈</Link>
          <Icon name="chevron" size={14} />
          <span aria-current="page">{profile ? `${profile.name} · 연결 기록` : '연결 기록'}</span>
        </nav>
      }
      account={
        state.profile.loggedIn ? (
          <HeaderAccount />
        ) : (
          <ButtonLink to="/login" size="sm" variant="secondary">
            로그인
          </ButtonLink>
        )
      }
    />
  )

  // Loading and error states share the two-column frame, so the card's entrance plays once and the content swaps in.
  if (!record) {
    return (
      <>
        {header}
        <main id="main-content" tabIndex={-1} className="connection-record-page focus:outline-none" data-entrance={entrance}>
          <CapsuleRecordLayout mate={<div className="capsule-record-mate-skeleton" aria-hidden="true" />}>
            <section
              className="capsule-record-card connection-record-window"
              aria-labelledby="connection-record-title"
              data-loading-screen={!error ? 'connection-record' : undefined}
            >
              {error ? (
                <div role="alert">
                  <h1 id="connection-record-title" className="capsule-record-title">연결 기록을 불러오지 못했어요.</h1>
                  <p className="capsule-record-summary">잠시 뒤 다시 시도해 주세요.</p>
                  <div className="capsule-record-error-actions">
                    <Button onClick={retry}>다시 시도</Button>
                    <ButtonLink to="/" variant="secondary">홈으로</ButtonLink>
                  </div>
                </div>
              ) : (
                <div aria-busy="true">
                  <h1 id="connection-record-title" className="sr-only">연결 기록</h1>
                  <span className="sr-only" role="status">연결 기록을 불러오고 있어요.</span>
                  <div aria-hidden="true">
                    <span className="skeleton-line capsule-record-skeleton" style={{ width: '58%', height: 40 }} />
                    <span className="skeleton-line capsule-record-skeleton" style={{ width: '40%', height: 28, marginTop: 20 }} />
                    <span className="skeleton-line capsule-record-skeleton" style={{ width: '100%', height: 92, marginTop: 28 }} />
                    <span className="skeleton-line capsule-record-skeleton" style={{ width: '100%', height: 64, marginTop: 24 }} />
                    <span className="skeleton-line capsule-record-skeleton" style={{ width: '100%', height: 56, marginTop: 24 }} />
                  </div>
                </div>
              )}
            </section>
          </CapsuleRecordLayout>
        </main>
      </>
    )
  }

  if (!profile) return <Navigate to="/records" replace />

  const name = profile.name
  const mate = matchedMate
  const report = record.serverReport
  const relation = report?.relation
  const recordLevelUp = Boolean(relation?.levelUp && relation.stageName?.trim())
  const levelUp = devLevelUp ?? recordLevelUp
  // A forced stage-up (dev only) borrows the wireframe's stages when the record has none.
  const devPreview = devLevelUp === true && !recordLevelUp
  const stage = {
    previous: relation?.previousStageName?.trim() || (devPreview ? '아는 사이' : undefined),
    current: relation?.stageName?.trim() || (devPreview ? '친구' : undefined),
  }
  const creditExhausted = Boolean(
    backend.wallet && backend.wallet.attendance + backend.wallet.invitation <= 0,
  )
  // An expression counts as new when it opened during this connection (the server may stamp it shortly after the end).
  const sessionUnlock = mateId
    ? backend.mateUnlocks?.[mateId]?.expressions.find(
        (item) =>
          item.unlocked &&
          item.unlockedAt !== undefined &&
          item.unlockedAt >= record.startedAt &&
          item.unlockedAt <= record.endedAt + UNLOCK_GRACE_MS,
      )
    : undefined
  const unlock = levelUp ? sessionUnlock ?? (devPreview ? DEV_SAMPLE_UNLOCK : undefined) : undefined
  const stageProgress = resolveStageProgress(relation)

  const previewScope = `record:${state.profile.userId ?? 'guest'}:${profile.id}:${record.id}:${modelAttempt}`

  return (
    <>
      {header}
      <main id="main-content" tabIndex={-1} className="connection-record-page focus:outline-none" data-entrance={entrance}>
        <CapsuleRecordCard
          // Switching states (dev) remounts it, so the content plays its opening again.
          key={levelUp ? 'levelup' : 'record'}
          titleId="connection-record-title"
          mateName={name}
          portrait={
            <MatePreview
              mode="record"
              mateId={profile.id}
              model={detail?.model}
              scope={previewScope}
              image={matePortrait(profile.id, mate?.image)}
              name={name}
              paused={false}
              showAgeBadge={false}
              stageClassName="connection-record-stage"
              initialExpression={levelUp ? 'celebrate' : 'smile'}
              overrideExpression={viewingExpression ? unlock?.expressionFile : null}
              onRetry={() => setModelAttempt((value) => value + 1)}
            />
          }
          quote={report?.closingLine?.trim() || undefined}
          modeLabel={recordModeLabel(report?.mode)}
          endedAt={record.endedAt}
          stage={stage}
          levelUp={levelUp}
          stats={{
            togetherSeconds: record.cameraFocus ? focusDetectedSeconds(record) : null,
            connectionSeconds: record.studySeconds,
            dialogueCount: typeof report?.dialogueCount === 'number' ? report.dialogueCount : undefined,
          }}
          nextStageCaption={formatNextStageCaption(relation, recordAmountText) ?? undefined}
          stageProgress={stageProgress ?? undefined}
          unlock={
            unlock && {
              kind: '표정',
              label: unlock.label,
              viewing: viewingExpression,
              onView: unlock.expressionFile ? () => setViewingExpression((value) => !value) : undefined,
            }
          }
          homeTo="/"
          reconnect={mate ? <ConnectMateButton mate={mate} label="다시 연결하기" errorPlacement="above" /> : undefined}
          notice={
            creditExhausted ? (
              <>
                친구를 초대하면 둘 다 크레딧 1,000을 받아요
                <Link to="/credits/invite" className="connection-record-invite-link">친구 초대</Link>
              </>
            ) : undefined
          }
        />
        {import.meta.env.DEV && (
          <button
            type="button"
            className="capsule-record-dev-toggle"
            aria-pressed={levelUp}
            onClick={() => { setDevLevelUp(!levelUp); setViewingExpression(false) }}
          >
            <span>DEV</span>
            {levelUp ? '일반 기록 보기' : '친밀도 상승 카드 보기'}
          </button>
        )}
      </main>
    </>
  )
}
