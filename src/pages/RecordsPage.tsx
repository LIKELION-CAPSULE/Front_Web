import { AppPanel } from '@/shared/ui/AppPanel'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { RecentConnectionRow } from '@/features/mates/components/RecentConnectionRow'
import {
  getRecordRange,
  recordPeriods,
  recordsInRange,
  type RecordPeriod,
} from '@/features/reports/record-period'
import {
  buildBarChartData,
  buildCalendarData,
  formatSelectedCellSummary,
  parseRecordsParams,
  resolveSummaryDisplay,
  type BarBucket,
} from '@/features/reports/records-view-utils'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { duration } from '@/shared/lib/format'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/my-mates.css'
import '@/features/reports/records-window.css'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

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
  return <AppPanel title="함께한 기록" className="records-window" loadingScreen={loadingScreen} bodyClassName="records-window-body">
    {children}
  </AppPanel>
}

function formatBarTooltip(bucket: BarBucket): string {
  if (bucket.sessions === 0) return `${bucket.fullLabel} · 기록이 없어요`
  const parts = [bucket.fullLabel]
  if (bucket.togetherSeconds > 0) parts.push(`함께한 시간 ${duration(bucket.togetherSeconds)}`)
  parts.push(`연결 시간 ${duration(bucket.connectionSeconds)}`)
  return parts.join(' · ')
}

export default function RecordsPage() {
  const { state } = useDemo()
  const { home, status } = useBackend()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(Date.now)
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)
  const [hoveredBarKey, setHoveredBarKey] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)

  const loading = status === 'loading' || isReviewRecordsLoading()
  const { period, offset, mate: selectedMateId } = parseRecordsParams(searchParams)
  const range = getRecordRange(period, now, offset)
  const prevRange = getRecordRange(period, now, offset - 1)
  const canShiftPrev = prevRange.startDay !== range.startDay
  const canShiftNext = offset < 0

  const catalogMates = useMemo(() => availableMates(home), [home])

  // Real server-reported non-dummy records
  const actualRecords = useMemo(
    () =>
      state.records.filter(
        (record) => Boolean(record.serverReport) && record.dataSource !== 'dummy',
      ),
    [state.records],
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
  const calendar = useMemo(() => buildCalendarData(periodRecords, range), [periodRecords, range])
  const barChart = useMemo(
    () => buildBarChartData(periodRecords, range, isCurrentPeriod),
    [isCurrentPeriod, periodRecords, range],
  )

  const defaultCell =
    calendar.cells.find((c) => c.isCurrent) ??
    [...calendar.cells].reverse().find((c) => c.sessions > 0) ??
    calendar.cells[0]
  const activeCell =
    (selectedCellKey ? calendar.cells.find((c) => c.key === selectedCellKey) : undefined) ??
    defaultCell

  const activeBar = hoveredBarKey
    ? barChart.buckets.find((b) => b.key === hoveredBarKey)
    : undefined

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
              <p className="records-stat-sub">{summary.secondaryCaption}</p>
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
            {/* Calendar */}
            <section
              className={period === 'week' ? 'records-card records-card--week' : 'records-card'}
              aria-label="함께한 날 달력"
            >
              <div className="records-card-head">
                <h2 className="records-card-title">함께한 날</h2>
                <div className="records-cal-legend" aria-hidden="true">
                  <span>적게</span>
                  <span className="records-cal-swatch" data-level="1" />
                  <span className="records-cal-swatch" data-level="2" />
                  <span className="records-cal-swatch" data-level="3" />
                  <span className="records-cal-swatch" data-level="4" />
                  <span>많이</span>
                </div>
              </div>

              <div className="records-cal-body">
                {calendar.mode === 'month' && (
                  <div className="records-cal-weekdays" aria-hidden="true">
                    {WEEKDAYS.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                )}

                <div className={`records-cal-grid records-cal-grid--${calendar.mode}`}>
                  {calendar.mode === 'month' &&
                    Array.from({ length: calendar.leadingBlanks }, (_, i) => (
                      <span key={`blank-${i}`} aria-hidden="true" />
                    ))}
                  {calendar.cells.map((cell) => {
                    const isSelected = activeCell?.key === cell.key
                    const showWeekTime = calendar.mode === 'week' && !cell.disabled && cell.sessions > 0
                    const weekTimeText =
                      cell.togetherSeconds > 0
                        ? duration(cell.togetherSeconds)
                        : duration(cell.connectionSeconds)
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className="records-cal-cell"
                        data-cal-cell={cell.key}
                        data-level={cell.level}
                        data-current={cell.isCurrent || undefined}
                        data-future={cell.disabled || undefined}
                        aria-pressed={isSelected}
                        aria-label={formatSelectedCellSummary(cell)}
                        disabled={cell.disabled}
                        onClick={() => setSelectedCellKey(cell.key)}
                      >
                        <span className="records-cal-cell-label">{cell.label}</span>
                        {showWeekTime && (
                          <span
                            className={
                              cell.togetherSeconds > 0
                                ? 'records-cal-cell-time'
                                : 'records-cal-cell-time records-cal-cell-time--conn'
                            }
                          >
                            {weekTimeText}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {activeCell && (
                  <p className="records-cal-selected" aria-live="polite" data-selected-day-summary>
                    {formatSelectedCellSummary(activeCell)}
                  </p>
                )}
              </div>
            </section>

            {/* Bar Chart */}
            <section
              className="records-card"
              role="region"
              aria-label={barChart.ariaSummary}
              data-bar-chart-section
            >
              <div className="records-card-head">
                <h2 className="records-card-title">날짜별 시간</h2>
                <div className="records-chart-legend" aria-hidden="true">
                  <span className="records-chart-legend-item">
                    <span className="records-chart-dot records-chart-dot--together" />
                    함께한 시간
                  </span>
                  <span className="records-chart-legend-item">
                    <span className="records-chart-dot records-chart-dot--connection" />
                    연결 시간
                  </span>
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
                        const connPct =
                          bucket.connectionSeconds > 0
                            ? Math.max(
                                3,
                                Math.min(
                                  100,
                                  (bucket.connectionSeconds / barChart.scale.maxSeconds) * 100,
                                ),
                              )
                            : 0
                        const togetherPct =
                          bucket.togetherSeconds > 0
                            ? Math.max(
                                3,
                                Math.min(
                                  100,
                                  (bucket.togetherSeconds / barChart.scale.maxSeconds) * 100,
                                ),
                              )
                            : 0
                        const dayNum = idx + 1
                        const hideNarrow =
                          period === 'month' && dayNum !== 1 && dayNum % 5 !== 0

                        return (
                          <button
                            key={bucket.key}
                            type="button"
                            className="records-bar-slot"
                            data-bar-slot={bucket.key}
                            aria-label={formatBarTooltip(bucket)}
                            onMouseEnter={() => setHoveredBarKey(bucket.key)}
                            onMouseLeave={() =>
                              setHoveredBarKey((cur) => (cur === bucket.key ? null : cur))
                            }
                            onFocus={() => setHoveredBarKey(bucket.key)}
                            onBlur={() =>
                              setHoveredBarKey((cur) => (cur === bucket.key ? null : cur))
                            }
                          >
                            <span className="records-bar-track" aria-hidden="true">
                              {connPct > 0 && (
                                <span
                                  className="records-bar-connection"
                                  style={{ height: `${connPct}%` }}
                                />
                              )}
                              {togetherPct > 0 && (
                                <span
                                  className="records-bar-together"
                                  style={{ height: `${togetherPct}%` }}
                                />
                              )}
                            </span>
                            <span
                              className="records-bar-label"
                              data-hide-narrow={hideNarrow || undefined}
                            >
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
            <ul className="my-mates-recent-list">
              {periodRecords.slice(0, visibleCount).map((record) => {
                const charId = record.characterIds[0] ?? ''
                const mateName =
                  mateNameByCharId.get(charId) ?? record.serverReport?.character?.name
                return (
                  <li key={record.id}>
                    <RecentConnectionRow
                      record={record}
                      mateName={mateName}
                      showConnectionLabel
                    />
                  </li>
                )
              })}
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
