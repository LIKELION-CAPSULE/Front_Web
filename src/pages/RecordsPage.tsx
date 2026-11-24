import { AppPanel } from '@/shared/ui/AppPanel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { mateAvatar } from '@/features/mates/artwork'
import { MateCommentBubble } from '@/features/records/MateCommentBubble'
import { buildMateComment, voiceFor } from '@/features/records/mate-comment'
import { CapsuleCalendar, CapsuleLegend } from '@/features/records/CapsuleCalendar'
import { CapsuleDayDetail, RecordConnectionRow } from '@/features/records/RecordConnectionRow'
import { buildCapsuleCalendar, defaultCapsuleDay, selectCapsuleDay } from '@/features/records/capsule-calendar'
import { isCompletedRecord } from '@/features/records/connection-day'
import { capsuleFromStudyRecord, capsuleRecordsFromStudyRecords } from '@/features/mates/capsule-jar/capsule-jar-data'
import { capsulesForConnection } from '@/features/mates/capsule-jar/capsule-floor-layout'
import { capsuleKeepsakes } from '@/features/mates/capsule-jar/capsule-moments'
import { CapsuleRecordCard } from '@/features/mates/capsule-jar/CapsuleRecordCard'
import {
  getRecordRange,
  recordPeriods,
  recordsInRange,
  type RecordPeriod,
} from '@/features/reports/record-period'
import {
  buildBarChartData,
  parseRecordsParams,
  resolveSummaryDisplay,
  type BarBucket,
} from '@/features/reports/records-view-utils'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { duration } from '@/shared/lib/format'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/reports/records-window.css'

type RecordMateOption = {
  id: string
  characterId: string
  name: string
}

function isReviewRecordsLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'records-loading'
  )
}

function RecordsWindowFrame({
  loadingScreen,
  children,
}: {
  loadingScreen?: 'records'
  children: React.ReactNode
}) {
  return <AppPanel title="함께한 기록" hideTitle className="records-window" loadingScreen={loadingScreen} bodyClassName="records-window-body">
    {children}
  </AppPanel>
}

function formatBarTooltip(bucket: BarBucket): string {
  if (bucket.sessions === 0) return `${bucket.fullLabel} · 기록이 없어요`
  const parts = [bucket.fullLabel, `함께한 시간 ${duration(bucket.connectionSeconds)}`]
  if (bucket.cameraSeconds > 0) parts.push(`카메라로 함께한 시간 ${duration(bucket.cameraSeconds)}`)
  return parts.join(' · ')
}

/** Bar height in % of the scale; any non-zero value stays visible. */
function barPercent(seconds: number, maxSeconds: number) {
  return seconds > 0 ? Math.max(3, Math.min(100, (seconds / maxSeconds) * 100)) : 0
}

export default function RecordsPage() {
  const { state } = useDemo()
  const { home, status } = useBackend()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(Date.now)
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)
  const [hoveredBarKey, setHoveredBarKey] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)
  /** Record card opened from a calendar day (that day's connections, newest first). */
  const [dayCard, setDayCard] = useState<{ key: string; index: number; phase: 'open' | 'closing' } | null>(null)
  const dayCardReturnFocus = useRef<HTMLElement | null>(null)

  const loading = status === 'loading' || isReviewRecordsLoading()
  const { period, offset, mate: selectedMateId } = parseRecordsParams(searchParams)
  const range = getRecordRange(period, now, offset)
  const prevRange = getRecordRange(period, now, offset - 1)
  const canShiftPrev = prevRange.startDay !== range.startDay
  const canShiftNext = offset < 0

  const catalogMates = useMemo(() => availableMates(home), [home])

  // Real server-reported non-dummy connections that have ended (records/connection-day.ts: one cutoff for the
  // summary, comment, calendar and list).
  const actualRecords = useMemo(
    () =>
      state.records.filter(
        (record) => Boolean(record.serverReport) && record.dataSource !== 'dummy' && isCompletedRecord(record, now),
      ),
    [state.records, now],
  )

  // Connected mates list (catalog mates + any additional mate present in server reports)
  const connectedMates = useMemo<RecordMateOption[]>(() => {
    const byCharId = new Map<string, RecordMateOption>()
    for (const m of catalogMates) {
      if (actualRecords.some((r) => r.characterIds.includes(m.characterId))) {
        byCharId.set(m.characterId, { id: m.id, characterId: m.characterId, name: m.name })
      }
    }
    for (const r of actualRecords) {
      const char = r.serverReport?.character
      if (!char) continue
      const charId = String(char.id)
      if (!byCharId.has(charId)) {
        const name = char.name?.trim() || `메이트 ${charId}`
        byCharId.set(charId, { id: `mate-${charId}`, characterId: charId, name })
      }
    }
    return [...byCharId.values()]
  }, [actualRecords, catalogMates])

  const mateNameByCharId = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of catalogMates) map.set(m.characterId, m.name)
    for (const m of connectedMates) map.set(m.characterId, m.name)
    return map
  }, [catalogMates, connectedMates])

  const activeMate =
    selectedMateId && connectedMates.length >= 2
      ? connectedMates.find((m) => m.id === selectedMateId) ?? null
      : null

  const updateParams = useCallback(
    (patch: { period?: RecordPeriod; offset?: number; mate?: string | null }) => {
      const next = new URLSearchParams(searchParams)
      const nextPeriod = patch.period ?? period
      const nextOffset = patch.offset !== undefined ? patch.offset : offset
      const nextMate = patch.mate !== undefined ? patch.mate : selectedMateId

      next.set('period', nextPeriod)
      if (nextOffset === 0) next.delete('offset')
      else next.set('offset', String(nextOffset))

      if (!nextMate || nextMate === 'all') next.delete('mate')
      else next.set('mate', nextMate)

      setSelectedCellKey(null)
      setHoveredBarKey(null)
      setVisibleCount(5)
      setDayCard(null)
      setSearchParams(next)
    },
    [offset, period, searchParams, selectedMateId, setSearchParams],
  )

  const periodRecords = useMemo(() => {
    const inPeriod = recordsInRange(actualRecords, range)
    if (!activeMate) return inPeriod
    return inPeriod.filter((r) => r.characterIds.includes(activeMate.characterId))
  }, [actualRecords, activeMate, range])

  const isCurrentPeriod = offset === 0
  const summary = useMemo(
    () => resolveSummaryDisplay(periodRecords, range, isCurrentPeriod),
    [isCurrentPeriod, periodRecords, range],
  )
  const capsuleCalendar = useMemo(() => buildCapsuleCalendar(periodRecords, range), [periodRecords, range])
  const barChart = useMemo(
    () => buildBarChartData(periodRecords, range, isCurrentPeriod),
    [isCurrentPeriod, periodRecords, range],
  )

  const activeDay =
    (selectedCellKey ? capsuleCalendar.days.find((d) => d.key === selectedCellKey && !d.isFuture) : undefined) ??
    defaultCapsuleDay(capsuleCalendar.days)
  const selectedDay = activeDay ? selectCapsuleDay(periodRecords, activeDay) : null
  const hasCameraTime = barChart.buckets.some((b) => b.cameraSeconds > 0)
  const revealKey = `${period}|${range.startDay}|${activeMate?.id ?? 'all'}`
  const mateNameOf = (record: (typeof periodRecords)[number]) =>
    mateNameByCharId.get(record.characterIds[0] ?? '') ?? record.serverReport?.character?.name

  // ── Record card of a calendar day ──
  const openDayCard = (key: string) => {
    const active = document.activeElement
    dayCardReturnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null
    setDayCard({ key, index: 0, phase: 'open' })
  }
  const closeDayCard = useCallback(() => {
    setDayCard((current) => (current && current.phase === 'open' ? { ...current, phase: 'closing' } : current))
  }, [])
  useEffect(() => {
    if (dayCard?.phase !== 'closing') return
    const timer = window.setTimeout(() => {
      setDayCard(null)
      dayCardReturnFocus.current?.focus({ preventScroll: true })
      dayCardReturnFocus.current = null
    }, 240)
    return () => window.clearTimeout(timer)
  }, [dayCard?.phase])
  const dayCardRecords = dayCard && selectedDay?.day.key === dayCard.key ? selectedDay.records : []
  const dayCardRecord = dayCard ? dayCardRecords[Math.min(dayCard.index, dayCardRecords.length - 1)] : undefined
  const dayCardCapsule = dayCardRecord ? capsuleFromStudyRecord(dayCardRecord) : null
  const dayCardMate = dayCardRecord
    ? catalogMates.find((mate) => dayCardRecord.characterIds.includes(mate.characterId))
    : undefined
  // The same keepsakes as the mate's capsules in 내 메이트: milestones of all that mate's connections.
  const dayCardKeepsake = dayCardCapsule && dayCardMate
    ? capsuleKeepsakes(capsuleRecordsFromStudyRecords(state.records, dayCardMate.characterId, now), capsulesForConnection, { now }).get(
        dayCardCapsule.id,
      )?.hours
    : undefined
  const dayCardView = dayCard && dayCardRecord && dayCardCapsule && (
    <CapsuleRecordCard
      key={dayCard.key}
      capsule={dayCardCapsule}
      mateName={mateNameOf(dayCardRecord) ?? '메이트'}
      mateId={dayCardMate?.id ?? 'chaerin'}
      keepsakeHours={dayCardKeepsake}
      placement="center"
      phase={dayCard.phase}
      animated
      frame="viewport"
      onClose={closeDayCard}
      pager={{
        index: Math.min(dayCard.index, dayCardRecords.length - 1),
        count: dayCardRecords.length,
        onPrevious: () => setDayCard((current) => (current ? { ...current, index: Math.max(0, current.index - 1) } : current)),
        onNext: () =>
          setDayCard((current) =>
            current ? { ...current, index: Math.min(dayCardRecords.length - 1, current.index + 1) } : current,
          ),
      }}
    />
  )

  const activeBar = hoveredBarKey
    ? barChart.buckets.find((b) => b.key === hoveredBarKey)
    : undefined

  // Mate comment: the selected mate speaks; with "전체" the mate met most in this period (else most recently).
  const speaker =
    activeMate ??
    (() => {
      const counts = new Map<string, number>()
      for (const r of periodRecords) for (const id of r.characterIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? actualRecords[0]?.characterIds[0]
      return connectedMates.find((m) => m.characterId === top) ?? connectedMates[0] ?? catalogMates[0] ?? null
    })()
  const speakerCatalog = speaker ? catalogMates.find((m) => m.characterId === speaker.characterId) : undefined
  const speakerRecords = speaker ? actualRecords.filter((r) => r.characterIds.includes(speaker.characterId)) : []
  const mateComment = speaker
    ? buildMateComment({
        range,
        offset,
        now,
        records: speakerRecords,
        seedKey: `${state.profile.userId ?? 'guest'}|${speaker.characterId}`,
        voice: voiceFor(speakerCatalog?.id),
      })
    : null
  const mateCommentView = speaker && mateComment && (
    <MateCommentBubble
      key={mateComment.text}
      comment={mateComment}
      mateName={speaker.name}
      avatarSrc={speakerCatalog ? mateAvatar(speakerCatalog.id, speakerCatalog.image) : undefined}
    />
  )

  const resetLabel =
    period === 'week' ? '이번 주로' : period === 'month' ? '이번 달로' : '올해로'

  if (loading) {
    return (
      <RecordsWindowFrame loadingScreen="records">
        <div className="records-skeleton-stack" aria-busy="true">
          <span className="sr-only" role="status">
            함께한 기록을 불러오고 있어요.
          </span>
          <div className="records-skeleton-cards" aria-hidden="true">
            <span className="skeleton-line records-skeleton-card" />
            <span className="skeleton-line records-skeleton-card" />
            <span className="skeleton-line records-skeleton-card" />
            <span className="skeleton-line records-skeleton-card" />
          </div>
          <span className="skeleton-line records-skeleton-panel" aria-hidden="true" />
        </div>
      </RecordsWindowFrame>
    )
  }

  if (actualRecords.length === 0) {
    return (
      <RecordsWindowFrame>
        {mateCommentView}
        <div className="records-empty-box">
          <p className="records-empty-title">아직 함께한 기록이 없어요.</p>
          <p className="records-empty-sub">메이트와 연결하면 여기에 쌓여요.</p>
          <ButtonLink to="/">메이트 만나러 가기</ButtonLink>
        </div>
      </RecordsWindowFrame>
    )
  }

  const showMateCard = connectedMates.length >= 2

  return (
    <RecordsWindowFrame>
      <div className="records-toolbar">
        <div className="records-period-tabs" role="tablist" aria-label="기록 기간">
          {recordPeriods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="records-period-tab"
              aria-selected={period === item.id}
              data-period-tab={item.id}
              onClick={() => updateParams({ period: item.id, offset: 0 })}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="records-date-nav">
          <button
            type="button"
            className="records-nav-btn"
            aria-label="이전 기간"
            disabled={!canShiftPrev}
            data-period-prev
            onClick={() => updateParams({ offset: offset - 1 })}
          >
            ‹
          </button>
          <span className="records-date-range">{range.dateLabel}</span>
          <button
            type="button"
            className="records-nav-btn"
            aria-label="다음 기간"
            disabled={!canShiftNext}
            data-period-next
            onClick={() => updateParams({ offset: offset + 1 })}
          >
            ›
          </button>
          {!isCurrentPeriod && (
            <button
              type="button"
              className="records-reset-btn"
              onClick={() => updateParams({ offset: 0 })}
            >
              {resetLabel}
            </button>
          )}
        </div>
      </div>

      {connectedMates.length >= 2 && (
        <nav className="records-mate-chips" aria-label="메이트 필터" data-records-mate-chips>
          <button
            type="button"
            className="records-mate-chip"
            aria-pressed={activeMate === null}
            data-records-mate="all"
            onClick={() => updateParams({ mate: null })}
          >
            전체
          </button>
          {connectedMates.map((m) => (
            <button
              key={m.id}
              type="button"
              className="records-mate-chip"
              aria-pressed={activeMate?.id === m.id}
              data-records-mate={m.id}
              onClick={() => updateParams({ mate: m.id })}
            >
              {m.name}
            </button>
          ))}
        </nav>
      )}

      {mateCommentView}

      {periodRecords.length === 0 ? (
        <div className="records-empty-box">
          <p className="records-empty-title">이 기간에는 함께한 기록이 없어요.</p>
          <ButtonLink to="/">메이트 만나러 가기</ButtonLink>
        </div>
      ) : (
        <>
          <div className="records-summary-grid" data-cols={showMateCard ? '4' : '3'}>
            <section className="records-stat-card records-stat-card--primary">
              <h2 className="records-stat-label">{summary.primaryLabel}</h2>
              <p className="records-stat-value">{duration(summary.primarySeconds)}</p>
              {summary.cameraCaption && <p className="records-stat-sub">{summary.cameraCaption}</p>}
            </section>
            <section className="records-stat-card">
              <h2 className="records-stat-label">함께한 날</h2>
              <p className="records-stat-value">{summary.activeDays}일</p>
            </section>
            <section className="records-stat-card">
              <h2 className="records-stat-label">연결 횟수</h2>
              <p className="records-stat-value">{summary.sessions}회</p>
            </section>
            {showMateCard && (
              <section className="records-stat-card">
                <h2 className="records-stat-label">함께한 메이트</h2>
                <p className="records-stat-value">{summary.mates}명</p>
              </section>
            )}
          </div>

          <div className="records-visuals-grid" data-period-mode={period}>
            <section className="records-card records-card--calendar" aria-labelledby="records-calendar-title">
              <div className="records-card-head">
                <h2 id="records-calendar-title" className="records-card-title">
                  함께한 날
                </h2>
                <CapsuleLegend mode={capsuleCalendar.mode} />
              </div>
              <CapsuleCalendar
                key={revealKey}
                data={capsuleCalendar}
                selectedKey={activeDay?.key}
                onSelect={(day) => {
                  setSelectedCellKey(day.key)
                  // A day with connections opens the same record card as a capsule in 내 메이트.
                  if (day.sessions > 0) openDayCard(day.key)
                }}
              />
              {selectedDay && <CapsuleDayDetail selection={selectedDay} mateNameOf={mateNameOf} />}
              {dayCardView}
            </section>

            <section
              className="records-card"
              role="region"
              aria-label={barChart.ariaSummary}
              data-bar-chart-section
            >
              <div className="records-card-head">
                <h2 className="records-card-title">{period === 'year' ? '달별 함께한 시간' : '날짜별 함께한 시간'}</h2>
                <div className="records-chart-legend" aria-hidden="true">
                  <span className="records-chart-legend-item">
                    <span className="records-chart-dot records-chart-dot--together" />
                    함께한 시간
                  </span>
                  {hasCameraTime && (
                    <span className="records-chart-legend-item">
                      <span className="records-chart-dot records-chart-dot--camera" />
                      카메라로 함께한 시간
                    </span>
                  )}
                </div>
              </div>

              <div className="records-chart-wrap">
                <div className="records-chart-tooltip" aria-live="polite">
                  {activeBar ? formatBarTooltip(activeBar) : '\u00A0'}
                </div>

                <div className="records-chart-body">
                  <div className="records-chart-yaxis" aria-hidden="true">
                    <span>0분</span>
                    {barChart.scale.ticks.map((tick) => (
                      <span key={tick.value}>{tick.label}</span>
                    ))}
                  </div>

                  <div className="records-chart-plot">
                    <div className="records-chart-gridlines" aria-hidden="true">
                      <span className="records-chart-gridline" />
                      {barChart.scale.ticks.map((tick) => (
                        <span key={tick.value} className="records-chart-gridline" />
                      ))}
                    </div>

                    <div
                      className="records-chart-bars"
                      data-dense={period === 'month' || undefined}
                      style={{
                        gridTemplateColumns: `repeat(${barChart.buckets.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {barChart.buckets.map((bucket, idx) => {
                        const togetherPct = barPercent(bucket.connectionSeconds, barChart.scale.maxSeconds)
                        const cameraPct = barPercent(bucket.cameraSeconds, barChart.scale.maxSeconds)
                        const dayNum = idx + 1
                        const hideNarrow = period === 'month' && dayNum !== 1 && dayNum % 5 !== 0

                        return (
                          <button
                            key={bucket.key}
                            type="button"
                            className="records-bar-slot"
                            data-bar-slot={bucket.key}
                            aria-label={formatBarTooltip(bucket)}
                            onMouseEnter={() => setHoveredBarKey(bucket.key)}
                            onMouseLeave={() => setHoveredBarKey((cur) => (cur === bucket.key ? null : cur))}
                            onFocus={() => setHoveredBarKey(bucket.key)}
                            onBlur={() => setHoveredBarKey((cur) => (cur === bucket.key ? null : cur))}
                          >
                            <span className="records-bar-track" aria-hidden="true">
                              {togetherPct > 0 && (
                                <span className="records-bar-together" style={{ height: `${togetherPct}%` }} />
                              )}
                              {cameraPct > 0 && (
                                <span className="records-bar-camera" style={{ height: `${cameraPct}%` }} />
                              )}
                            </span>
                            <span className="records-bar-label" data-hide-narrow={hideNarrow || undefined}>
                              {bucket.axisLabel}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="records-recent-section" aria-labelledby="records-recent-title">
            <h2 id="records-recent-title" className="records-recent-title">
              최근 연결
            </h2>
            <ul className="records-row-list">
              {periodRecords.slice(0, visibleCount).map((record) => (
                <li key={record.id}>
                  <RecordConnectionRow record={record} mateName={mateNameOf(record)} />
                </li>
              ))}
            </ul>
            {periodRecords.length > visibleCount && (
              <div className="records-more-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setVisibleCount((v) => v + 5)}
                >
                  더 보기
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </RecordsWindowFrame>
  )
}
