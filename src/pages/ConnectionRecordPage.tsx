import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useServerReport } from '@/features/backend/use-server-report'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates, launchMateId, mateProfile } from '@/features/mates/catalog'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { matePortrait } from '@/features/mates/artwork'
import { focusDetectedSeconds } from '@/features/session/focus'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { CapsuleRecordCard, CapsuleRecordLayout } from '@/features/reports/components/CapsuleRecordCard'
import { ConnectionRecordCardSkeleton } from '@/features/reports/components/ConnectionRecordSkeleton'
import { recordAmountText, recordModeLabel } from '@/features/reports/capsule-record'
import { reportSettlement } from '@/features/backend/adapters'
import { formatNextStageCaption, resolveStageProgress } from '@/features/mates/affinity-progress'
import { normalizeAffinityStage } from '@/features/mates/affinity-stages'
import { resolveMateFeatures } from '@/features/mates/mate-features'
import { worldOpenedAt, worldStageUpLine } from '@/features/mates/mate-worlds'
import { useMateWorldContent } from '@/features/mates/use-mate-worlds'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'


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

  const mates = availableMates(backend.home)
  // A non-launch server mate (「말포이」) maps to none: the page shows no mate rather than 채린 (catalog.ts `launchMateId`).
  const recordMateId = record
    ? launchMateId({ id: record.characterIds[0], name: record.characterName ?? record.serverReport?.mate?.name }, mates)
    : undefined
  const matchedMate = record
    ? mates.find((value) => value.id === recordMateId)
    : mates.length === 1
      ? mates[0]
      : undefined
  const profile = record ? matchedMate ?? mateProfile(recordMateId) : matchedMate

  const mateId = matchedMate?.id
  const detail = mateId ? backend.mateDetails[mateId] : undefined
  // 세계관 examples for the stage-up line (development with the local mock; production: none).
  const worldsOn = resolveMateFeatures(import.meta.env.DEV, null).world
  const worldSamples = useMateWorldContent({ enabled: worldsOn, mateId, mateName: profile?.name, mateImage: matchedMate?.image })
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
                  <ConnectionRecordCardSkeleton />
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
  const relation = reportSettlement(report)
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
  // A stage-up opens that stage's world (mate-worlds.ts): the new stage from the record, put on the stage table by its
  // name; its place when 22 · 23 `relation.unlocked[]` names one (the type is not fixed yet) or from the examples.
  const newStage = levelUp ? normalizeAffinityStage(relation?.stage, stage.current)?.stage : undefined
  const openedWorld = worldsOn && newStage
    ? worldOpenedAt(newStage, devPreview ? undefined : report?.relation?.unlocked, worldSamples ?? [])
    : null
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
              onRetry={() => setModelAttempt((value) => value + 1)}
            />
          }
          quote={report?.closingLine?.trim() || undefined}
          modeLabel={recordModeLabel(undefined /* 22 · 23 have no `mode` yet (backend request) */)}
          endedAt={record.endedAt}
          stage={stage}
          levelUp={levelUp}
          stats={{
            togetherSeconds: record.cameraFocus ? focusDetectedSeconds(record) : null,
            connectionSeconds: record.studySeconds,
            dialogueCount: typeof report?.messageCount === 'number' ? report.messageCount : undefined,
          }}
          nextStageCaption={formatNextStageCaption(relation, recordAmountText) ?? undefined}
          stageProgress={stageProgress ?? undefined}
          unlock={
            openedWorld ? { line: worldStageUpLine(openedWorld), ...(mateId ? { to: `/mates/me?mate=${mateId}` } : {}) } : undefined
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
            onClick={() => setDevLevelUp(!levelUp)}
          >
            <span>DEV</span>
            {levelUp ? '일반 기록 보기' : '친밀도 상승 카드 보기'}
          </button>
        )}
      </main>
    </>
  )
}
