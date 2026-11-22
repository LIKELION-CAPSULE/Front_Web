import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useServerReport } from '@/features/backend/use-server-report'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates, mateProfileByName } from '@/features/mates/catalog'
import { formatNextStageCaption, resolveStageProgress } from '@/features/mates/affinity-progress'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { matePortrait } from '@/features/mates/artwork'
import { focusDetectedSeconds } from '@/features/session/focus'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { AnimatedDuration } from '@/shared/ui/number-counter/AnimatedDuration'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { dateLabel, duration } from '@/shared/lib/format'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'

function formatModeLabel(mode: string | undefined): string {
  if (mode === 'BASIC') return '기본 모드'
  if (mode === 'ADVANCED') return '고급 모드'
  return ''
}

export default function ConnectionRecordPage() {
  const { connectionId } = useParams()
  const backend = useBackend()
  const { state } = useDemo()
  const { record, error, retry, redirectTo } = useServerReport(connectionId)
  const [modelAttempt, setModelAttempt] = useState(0)

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

  // Loading & Error states share the same desktop window frame
  if (!record) {
    const fallbackTitle = profile ? `${profile.name} · 연결 끊음` : '연결 기록'
    return (
      <>
        {header}
        <main
          id="main-content"
          tabIndex={-1}
          className="page-container mate-detail connection-record-page focus:outline-none"
        >
          <section
            className="mate-detail-window desktop-window desktop-window--active connection-record-window"
            aria-labelledby="connection-record-title"
            data-loading-screen={!error ? 'connection-record' : undefined}
          >
            <div className="desktop-window-titlebar mate-window-titlebar-static">
              <div className="desktop-window-title-left">
                <span className="desktop-mate-title">
                  <span className="desktop-mate-dot desktop-mate-dot--offline" aria-hidden="true" />
                  <span>{fallbackTitle}</span>
                </span>
              </div>
              <div className="desktop-window-title-right">
                <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
                <div className="desktop-window-controls" aria-hidden="true">
                  <span className="desktop-window-dot" />
                  <span className="desktop-window-dot" />
                  <span className="desktop-window-dot" />
                </div>
              </div>
            </div>

            {error ? (
              <div className="desktop-window-body connection-record-error-body" role="alert">
                <h1 id="connection-record-title" className="connection-record-error-title">
                  연결 기록을 불러오지 못했어요.
                </h1>
                <p className="connection-record-error-sub">잠시 뒤 다시 시도해 주세요.</p>
                <div className="connection-record-actions">
                  <Button onClick={retry}>다시 시도</Button>
                  <ButtonLink to="/" variant="secondary">
                    홈으로
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="desktop-window-body mate-detail-window-body connection-record-body" aria-busy="true">
                <span className="sr-only" role="status">
                  연결 기록을 불러오고 있어요.
                </span>
                <div className="mate-detail-portrait connection-record-skeleton-stage" aria-hidden="true" />
                <div className="mate-detail-copy connection-record-copy" aria-hidden="true">
                  <span className="skeleton-line connection-record-skeleton-title" />
                  <span className="skeleton-line connection-record-skeleton-sub" />
                  <div className="connection-record-stats">
                    <span className="skeleton-line connection-record-skeleton-stat" />
                    <span className="skeleton-line connection-record-skeleton-stat" />
                  </div>
                  <span className="skeleton-line connection-record-skeleton-bar" />
                  <div className="connection-record-actions">
                    <span className="skeleton-line connection-record-skeleton-btn" />
                    <span className="skeleton-line connection-record-skeleton-btn" />
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </>
    )
  }

  if (!profile) return <Navigate to="/records" replace />

  const name = profile.name
  const mate = matchedMate
  const report = record.serverReport
  const relation = report?.relation
  const stageName = relation?.stageName?.trim() || ''
  const nextStageCaption = formatNextStageCaption(relation, duration)
  const modeLabel = formatModeLabel(report?.mode)
  const subtitle = modeLabel
    ? `${modeLabel} · ${dateLabel(record.endedAt, true)} 연결 끊음`
    : `${dateLabel(record.endedAt, true)} 연결 끊음`
  const dialogueCount = typeof report?.dialogueCount === 'number' ? report.dialogueCount : undefined
  const creditExhausted = Boolean(
    backend.wallet && backend.wallet.attendance + backend.wallet.invitation <= 0,
  )
  const stageProgress = resolveStageProgress(relation)
  const progressPct = stageProgress !== null ? Math.round(stageProgress * 100) : null

  const previewScope = `record:${state.profile.userId ?? 'guest'}:${profile.id}:${record.id}:${modelAttempt}`

  return (
    <>
      {header}
      <main
        id="main-content"
        tabIndex={-1}
        className="page-container mate-detail connection-record-page focus:outline-none"
      >
        <section
          className="mate-detail-window desktop-window desktop-window--active connection-record-window"
          aria-labelledby="connection-record-title"
        >
          <div className="desktop-window-titlebar mate-window-titlebar-static">
            <div className="desktop-window-title-left">
              <span className="desktop-mate-title">
                <span className="desktop-mate-dot desktop-mate-dot--offline" aria-hidden="true" />
                <span>
                  {name} · 연결 끊음 · {duration(record.studySeconds)}
                </span>
              </span>
            </div>
            <div className="desktop-window-title-right">
              <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </div>

          <div className="desktop-window-body mate-detail-window-body connection-record-body">
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
              staticSpeech={report?.closingLine?.trim() || undefined}
              initialExpression={relation?.levelUp ? 'celebrate' : 'smile'}
              onRetry={() => setModelAttempt((value) => value + 1)}
            />

            <div className="mate-detail-copy connection-record-copy">
              <h1 id="connection-record-title">오늘도 함께했어요</h1>
              <p className="connection-record-subtitle">{subtitle}</p>

              <dl className="connection-record-stats">
                <div className="connection-record-stat">
                  <dt>연결 시간</dt>
                  <dd>
                    <AnimatedDuration seconds={record.studySeconds} measured />
                  </dd>
                </div>
                <div className="connection-record-stat">
                  <dt>함께한 시간(캠)</dt>
                  <dd>
                    {record.cameraFocus ? (
                      <AnimatedDuration seconds={focusDetectedSeconds(record)} measured />
                    ) : (
                      <span className="connection-record-stat-empty">카메라를 켜지 않았어요</span>
                    )}
                  </dd>
                </div>
                {dialogueCount !== undefined && (
                  <div className="connection-record-stat">
                    <dt>나눈 대화 수</dt>
                    <dd>
                      <NumberCounter value={dialogueCount} />
                    </dd>
                  </div>
                )}
              </dl>

              {stageName && (
                <section className="connection-record-affinity" aria-label="친밀도">
                  <div className="connection-record-affinity-head">
                    <span className="connection-record-affinity-label">친밀도</span>
                    <strong className="connection-record-affinity-stage">{stageName}</strong>
                    {relation?.levelUp && (
                      <span className="connection-record-levelup">
                        {relation.previousStageName
                          ? `${relation.previousStageName} → ${stageName}`
                          : `새 단계: ${stageName}`}
                      </span>
                    )}
                  </div>
                  {(progressPct !== null || nextStageCaption !== null) && (
                    <div className="connection-record-affinity-progress">
                      {progressPct !== null && (
                        <div className="connection-record-progress-track" aria-hidden="true">
                          <div
                            className="connection-record-progress-fill"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                      {nextStageCaption !== null && (
                        <p className="connection-record-progress-caption">{nextStageCaption}</p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {creditExhausted && (
                <div className="connection-record-credit-notice">
                  <span>친구를 초대하면 둘 다 크레딧 1,000을 받아요</span>
                  <Link to="/invite" className="connection-record-invite-link">
                    친구 초대
                  </Link>
                </div>
              )}

              <div className="connection-record-actions">
                <ButtonLink to="/" variant="secondary">
                  홈으로
                </ButtonLink>
                {mate && <ConnectMateButton mate={mate} label="다시 연결하기" />}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
