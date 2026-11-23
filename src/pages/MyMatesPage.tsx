import { AppPanel } from '@/shared/ui/AppPanel'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates, mateByName } from '@/features/mates/catalog'
import { matePortrait } from '@/features/mates/artwork'
import { formatNextStageCaption, resolveStageProgress } from '@/features/mates/affinity-progress'
import {
  countMateUnlocks,
  formatFirstMetDate,
  groupLockedVoices,
  latestConnectedTimestamp,
  summarizeMateRecords,
  type MateVoiceUnlock,
} from '@/features/mates/my-mates-utils'
import { SampleAudioPlayer } from '@/features/mates/sample-audio'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { RecentConnectionRow } from '@/features/mates/components/RecentConnectionRow'
import { ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { dateLabel, duration } from '@/shared/lib/format'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/my-mates.css'

const EXPRESSION_PREVIEW_MS = 3_000

function isReviewMyMatesLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'my-mates-loading'
  )
}

function MyMatesWindowFrame({
  loadingScreen,
  children,
}: {
  loadingScreen?: 'my-mates'
  children: React.ReactNode
}) {
  return <AppPanel title="내 메이트" className="my-mates-window" loadingScreen={loadingScreen} bodyClassName="my-mates-window-body">
    {children}
  </AppPanel>
}

export default function MyMatesPage() {
  const {
    home,
    activeSummary,
    status,
    mateDetails,
    loadMateDetail,
    mateUnlocks,
    mateRelationStats,
  } = useBackend()
  const { state } = useDemo()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modelAttempt, setModelAttempt] = useState(0)

  // Expression preview state (reverts after 3s or toggle off)
  const [activeExpression, setActiveExpression] = useState<string | null>(null)
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Single audio player guarantees at most one voice plays at a time
  const [player] = useState(() => new SampleAudioPlayer())
  const audioStatus = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  const loading = status === 'loading' || isReviewMyMatesLoading()

  const connectedMates = useMemo(() => {
    const filtered = availableMates(home).filter(
      (mate) =>
        state.activeSession?.characterIds.includes(mate.characterId) ||
        Boolean(mateByName(activeSummary?.characterName, [mate])) ||
        state.records.some(
          (record) => Boolean(record.serverReport) && record.characterIds.includes(mate.characterId),
        ),
    )
    return filtered.slice().sort((a, b) => {
      const aActive =
        Boolean(state.activeSession?.characterIds.includes(a.characterId)) ||
        Boolean(mateByName(activeSummary?.characterName, [a]))
      const bActive =
        Boolean(state.activeSession?.characterIds.includes(b.characterId)) ||
        Boolean(mateByName(activeSummary?.characterName, [b]))
      return (
        latestConnectedTimestamp(b.characterId, state.records, bActive) -
        latestConnectedTimestamp(a.characterId, state.records, aActive)
      )
    })
  }, [home, state.activeSession, state.records, activeSummary])

  const requestedMateId = searchParams.get('mate')
  const selectedMate =
    (requestedMateId ? connectedMates.find((mate) => mate.id === requestedMateId) : undefined) ??
    connectedMates[0]

  const selectedMateId = selectedMate?.id
  const detail = selectedMateId ? mateDetails[selectedMateId] : undefined

  // Load Live2D/preview detail for selected mate if available
  useEffect(() => {
    if (!selectedMateId || !loadMateDetail || detail) return
    void loadMateDetail(selectedMateId, modelAttempt > 0).catch(() => {})
  }, [selectedMateId, loadMateDetail, detail, modelAttempt])

  // Stop voice and clear expression override when switching mates or unmounting
  useEffect(() => {
    return () => {
      clearTimeout(expressionTimerRef.current)
      player.stop()
    }
  }, [selectedMateId, player])

  const selectMate = useCallback(
    (mateId: string) => {
      clearTimeout(expressionTimerRef.current)
      setActiveExpression(null)
      player.stop()
      setPlayingVoiceId(null)
      const next = new URLSearchParams(searchParams)
      if (next.get('mate') !== mateId) {
        next.set('mate', mateId)
        setSearchParams(next)
      }
    },
    [player, searchParams, setSearchParams],
  )

  const toggleExpression = useCallback((expressionFile: string) => {
    clearTimeout(expressionTimerRef.current)
    setActiveExpression((current) => {
      if (current === expressionFile) return null
      expressionTimerRef.current = setTimeout(() => {
        setActiveExpression(null)
      }, EXPRESSION_PREVIEW_MS)
      return expressionFile
    })
  }, [])

  const toggleVoice = useCallback(
    (voice: MateVoiceUnlock) => {
      if (!voice.unlocked || !voice.audioUrl) return
      const isCurrentPlaying =
        playingVoiceId === voice.id && (audioStatus === 'playing' || audioStatus === 'loading')
      if (isCurrentPlaying) {
        player.stop()
        setPlayingVoiceId(null)
        return
      }
      setPlayingVoiceId(voice.id)
      void player.play(voice.audioUrl)
    },
    [audioStatus, player, playingVoiceId],
  )

  if (loading) {
    return (
      <MyMatesWindowFrame loadingScreen="my-mates">
        <div aria-busy="true">
          <span className="sr-only" role="status">
            내 메이트 정보를 불러오고 있어요.
          </span>
          <div className="my-mates-skeleton-chips" aria-hidden="true">
            <span className="skeleton-line my-mates-skeleton-chip" />
          </div>
          <div className="my-mates-skeleton-profile" aria-hidden="true">
            <span className="skeleton-line my-mates-skeleton-stage" />
            <div className="my-mates-skeleton-info">
              <span className="skeleton-line my-mates-skeleton-title" />
              <span className="skeleton-line my-mates-skeleton-bar" />
              <span className="skeleton-line my-mates-skeleton-stats" />
              <span className="skeleton-line my-mates-skeleton-btn" />
            </div>
          </div>
        </div>
      </MyMatesWindowFrame>
    )
  }

  if (!selectedMate) {
    return (
      <MyMatesWindowFrame>
        <div className="my-mates-empty-box">
          <p className="my-mates-empty-title">아직 연결한 메이트가 없어요.</p>
          <ButtonLink to="/">메이트 만나러 가기</ButtonLink>
        </div>
      </MyMatesWindowFrame>
    )
  }

  const serverStats = mateRelationStats?.[selectedMate.id]
  const summary = summarizeMateRecords(state.records, selectedMate.characterId, serverStats)
  const relation = summary.relation
  const stageName = relation?.stageName?.trim() || ''
  const stageProgress = resolveStageProgress(relation)
  const progressPct = stageProgress !== null ? Math.round(stageProgress * 100) : null
  const nextStageCaption = formatNextStageCaption(relation, duration)
  const hasStats =
    summary.togetherSeconds !== null ||
    summary.connectionCount !== null ||
    summary.firstMetAt !== null

  const unlocks = mateUnlocks?.[selectedMate.id]
  const unlockCounts = countMateUnlocks(unlocks)
  const previewScope = `my-mates:${state.profile.userId ?? 'guest'}:${selectedMate.id}:${modelAttempt}`

  return (
    <MyMatesWindowFrame>
      <nav className="my-mates-chips" aria-label="연결한 메이트">
        {connectedMates.map((mate) => {
          const isSelected = mate.id === selectedMate.id
          return (
            <button
              key={mate.id}
              type="button"
              className="my-mates-chip"
              aria-pressed={isSelected}
              data-mate-chip={mate.id}
              onClick={() => selectMate(mate.id)}
            >
              <span className="desktop-mate-dot" aria-hidden="true" />
              <span>{mate.name}</span>
            </button>
          )
        })}
      </nav>

      <div className="my-mates-profile">
        <MatePreview
          mode="record"
          mateId={selectedMate.id}
          model={detail?.model}
          scope={previewScope}
          image={matePortrait(selectedMate.id, selectedMate.image)}
          name={selectedMate.name}
          paused={false}
          suppressSpeech
          showAgeBadge={false}
          initialExpression="smile"
          overrideExpression={activeExpression}
          stageClassName="my-mates-stage"
          onRetry={() => setModelAttempt((value) => value + 1)}
        />

        <div className="my-mates-info">
          <h2 className="my-mates-heading">
            <span>{selectedMate.name}</span>
            {stageName && <span className="my-mates-stage-name">· {stageName}</span>}
          </h2>

          {(progressPct !== null || nextStageCaption !== null) && (
            <div className="my-mates-progress">
              {progressPct !== null && (
                <div
                  className="my-mates-progress-track"
                  role="progressbar"
                  aria-label="친밀도 진행률"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPct}
                >
                  <div className="my-mates-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              {nextStageCaption !== null && (
                <p className="my-mates-progress-caption">{nextStageCaption}</p>
              )}
            </div>
          )}

          {hasStats && (
            <dl className="my-mates-stats">
              {summary.togetherSeconds !== null && (
                <div className="my-mates-stat">
                  <dt>함께한 시간</dt>
                  <dd>{duration(summary.togetherSeconds)}</dd>
                </div>
              )}
              {summary.connectionCount !== null && (
                <div className="my-mates-stat">
                  <dt>연결 횟수</dt>
                  <dd>{summary.connectionCount}회</dd>
                </div>
              )}
              {summary.firstMetAt !== null && (
                <div className="my-mates-stat">
                  <dt>처음 만난 날</dt>
                  <dd>{formatFirstMetDate(summary.firstMetAt)}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="my-mates-cta">
            <ConnectMateButton mate={selectedMate} />
          </div>
        </div>
      </div>

      {unlocks && unlockCounts && (
        <section className="my-mates-section" aria-labelledby="my-mates-unlocks-title" data-unlocks-section>
          <h2 id="my-mates-unlocks-title" className="my-mates-section-title">
            해금 {unlockCounts.unlocked} / {unlockCounts.total}
          </h2>

          {unlocks.expressions.length > 0 && (
            <>
              <h3 className="my-mates-subsection-title">표정</h3>
              <div className="my-mates-expr-grid">
                {unlocks.expressions.map((item) => {
                  if (!item.unlocked) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="my-mates-expr-tile my-mates-expr-tile--locked"
                        disabled
                        data-expr-locked="true"
                      >
                        <span className="my-mates-expr-lock-row">
                          <Icon name="lock" size={16} />
                        </span>
                        {item.condition && (
                          <span className="my-mates-expr-condition">{item.condition}</span>
                        )}
                      </button>
                    )
                  }
                  const isActive = activeExpression === item.expressionFile
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="my-mates-expr-tile"
                      aria-pressed={isActive}
                      data-expr-file={item.expressionFile}
                      onClick={() => toggleExpression(item.expressionFile)}
                    >
                      <span className="my-mates-expr-name">{item.label}</span>
                      {item.unlockedAt !== undefined && (
                        <span className="my-mates-expr-date">{dateLabel(item.unlockedAt)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {unlocks.voices.length > 0 && (
            <>
              <h3 className="my-mates-subsection-title">보이스 대사</h3>
              <ul className="my-mates-voice-list">
                {unlocks.voices
                  .filter((item) => item.unlocked)
                  .map((item) => {
                    const isPlaying =
                      playingVoiceId === item.id &&
                      (audioStatus === 'playing' || audioStatus === 'loading')
                    return (
                      <li
                        key={item.id}
                        className="my-mates-voice-item"
                        data-voice-id={item.id}
                        data-playing={isPlaying ? 'true' : undefined}
                      >
                        <button
                          type="button"
                          className="my-mates-voice-btn"
                          aria-label={
                            isPlaying ? `'${item.text}' 멈추기` : `'${item.text}' 다시 듣기`
                          }
                          aria-pressed={isPlaying}
                          disabled={!item.audioUrl}
                          onClick={() => toggleVoice(item)}
                        >
                          <Icon name={isPlaying ? 'stop' : 'play'} size={14} />
                        </button>
                        <span className="my-mates-voice-text">{item.text}</span>
                      </li>
                    )
                  })}
                {groupLockedVoices(unlocks.voices).map((group) => (
                  <li
                    key={group.condition || '__empty__'}
                    className="my-mates-voice-item my-mates-voice-item--locked"
                    data-locked-voice-group={group.condition || 'default'}
                  >
                    <span className="my-mates-voice-lock" aria-hidden="true">
                      <Icon name="lock" size={14} />
                    </span>
                    <span className="my-mates-voice-condition">{group.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {summary.recentRecords.length > 0 && (
        <section className="my-mates-section" aria-labelledby="my-mates-recent-title">
          <h2 id="my-mates-recent-title" className="my-mates-section-title">
            최근 연결
          </h2>
          <ul className="my-mates-recent-list">
            {summary.recentRecords.map((record) => (
              <li key={record.id}>
                <RecentConnectionRow record={record} />
              </li>
            ))}
          </ul>
          {summary.hasMoreRecords && (
            <Link to="/records" className="my-mates-more-link">
              내 기록에서 모두 보기
              <Icon name="chevron" size={14} />
            </Link>
          )}
        </section>
      )}
    </MyMatesWindowFrame>
  )
}
