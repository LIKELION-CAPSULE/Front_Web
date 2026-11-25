import { AppPanel } from '@/shared/ui/AppPanel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import type { StudyRecord } from '@/features/demo/types'
import { availableMates } from '@/features/mates/catalog'
import { useMyMates } from '@/features/mates/use-my-mates'
import { useRecordsData } from '@/features/records/use-records-data'
import { isDayRecord, recordsSummary, type RecordsMate } from '@/features/records/records-source'
import { mateAvatar } from '@/features/mates/artwork'
import { MateCommentBubble } from '@/features/records/MateCommentBubble'
import { collectRecordsFacts, mateCommentFromFacts, voiceFor } from '@/features/records/mate-comment'
import { CapsuleDayDetail, DayRemainderRow, RecordConnectionRow } from '@/features/records/RecordConnectionRow'
import { defaultCapsuleDay, selectCapsuleDay } from '@/features/records/capsule-calendar'
import { connectionDayKey } from '@/features/records/connection-day'
import { CapsuleBoard } from '@/features/records/capsule-board/CapsuleBoard'
import { SatinBackdrop } from '@/features/records/satin-backdrop/SatinBackdrop'
import { BOARD, buildCapsuleBoard, offsetContaining } from '@/features/records/capsule-board/capsule-board-layout'
import {
  boardViewSlot,
  defaultBoardView,
  readStoredBoardViews,
  storeBoardViews,
  type StoredBoardViews,
  supportsWebGL,
  yearColumnsFor,
  type BoardEmphasisControl,
  type BoardView,
} from '@/features/records/capsule-board/capsule-board-view'
import type { BoardBenchmark } from '@/features/records/capsule-board/capsule-board-scene'
import { capsuleFromStudyRecord } from '@/features/mates/capsule-jar/capsule-jar-data'
import type { CapsuleKeepsake } from '@/features/mates/capsule-jar/capsule-moments'
import { CapsuleRecordCard } from '@/features/mates/capsule-jar/CapsuleRecordCard'
import {
  getRecordRange,
  recordPeriods,
  type RecordPeriod,
} from '@/features/reports/record-period'
import { parseRecordsParams } from '@/features/reports/records-view-utils'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { duration } from '@/shared/lib/format'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/reports/records-window.css'

/** The server counts a day from 05:00 Seoul time (38): "today" is the day that began at the last 05:00. */
const DAY_START_MS = 5 * 3600 * 1000
/** 38 has no keepsakes (they need every connection of a mate): the board shows none. */
const NO_KEEPSAKES: ReadonlyMap<string, CapsuleKeepsake> = new Map()

function isReviewRecordsLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'records-loading'
  )
}

/** Development only: the board's frame-rate probe for measurements (`window.__capsuleBoard.benchmark(ms)`). */
const exposeBoardBenchmark = import.meta.env.DEV
  ? (controller: { benchmark: (durationMs: number) => Promise<BoardBenchmark> } | null) => {
      const target = window as unknown as { __capsuleBoard?: unknown }
      if (controller) target.__capsuleBoard = controller
      else delete target.__capsuleBoard
    }
  : undefined

function RecordsWindowFrame({
  loadingScreen,
  children,
}: {
  loadingScreen?: 'records'
  children: React.ReactNode
}) {
  return (
    <>
      <SatinBackdrop />
      <AppPanel title="함께한 기록" hideTitle className="records-window" loadingScreen={loadingScreen} bodyClassName="records-window-body">
        {children}
      </AppPanel>
    </>
  )
}

/** Block title: a small icon and the title, the same in every block (내 메이트 `BlockLabel`). */
function BlockTitle({ id, icon, children }: { id?: string; icon: IconName; children: React.ReactNode }) {
  return (
    <h2 id={id} className="records-block-title">
      <span className="records-block-title-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      {children}
    </h2>
  )
}

export default function RecordsPage() {
  const { state } = useDemo()
  const { home, status } = useBackend()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(Date.now)
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)
  /** Record card opened from a board day (that day's connections, newest first). */
  const [dayCard, setDayCard] = useState<{ key: string; index: number; phase: 'open' | 'closing' } | null>(null)
  const dayCardReturnFocus = useRef<HTMLElement | null>(null)
  // Board: 2D / 2.5D (the viewer's last choice, else 2.5D on desktop and 2D under 960 px), stage width, WebGL.
  const [boardViews, setBoardViews] = useState<StoredBoardViews>(readStoredBoardViews)
  const [stageWidth, setStageWidth] = useState(0)
  const [boardFallback, setBoardFallback] = useState(() => !supportsWebGL())
  const emphasisControl = useRef<BoardEmphasisControl | null>(null)
  const onEmphasisControl = useCallback((control: BoardEmphasisControl | null) => {
    emphasisControl.current = control
  }, [])

  const { period, offset, mate: selectedMateId } = parseRecordsParams(searchParams)
  // 2D / 2.5D per period: week and month share the viewer's choice, the year keeps its own (2D until chosen).
  const [viewportWidth] = useState(() => window.innerWidth)
  const boardView = defaultBoardView(viewportWidth, boardViews, period)
  const range = useMemo(() => getRecordRange(period, now - DAY_START_MS, offset), [period, now, offset])
  const prevRange = getRecordRange(period, now - DAY_START_MS, offset - 1)
  const canShiftPrev = prevRange.startDay !== range.startDay
  const canShiftNext = offset < 0

  const catalogMates = useMemo(() => availableMates(home), [home])

  // Mates met at least once (37), in the server's order (most recent first): the filter chips. Each keeps its server
  // id(s) for the reads of 38 (one persona can have two).
  const myMates = useMyMates()
  const connectedMates = useMemo<RecordsMate[] | null>(() => {
    if (!myMates.data) return null
    return catalogMates
      .filter((mate) => myMates.byMate.has(mate.id))
      .sort((a, b) => (myMates.byMate.get(b.id)?.lastConnectedAt ?? 0) - (myMates.byMate.get(a.id)?.lastConnectedAt ?? 0))
      .map((mate) => ({ id: mate.id, characterId: mate.characterId, name: mate.name, serverIds: myMates.byMate.get(mate.id)!.serverIds }))
  }, [catalogMates, myMates.byMate, myMates.data])

  const mateNameByCharId = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of catalogMates) map.set(m.characterId, m.name)
    for (const m of connectedMates ?? []) map.set(m.characterId, m.name)
    return map
  }, [catalogMates, connectedMates])

  const activeMate =
    selectedMateId && connectedMates && connectedMates.length >= 2
      ? connectedMates.find((m) => m.id === selectedMateId) ?? null
      : null

  // 38 for the range and the filter (records-source.ts: day records from the buckets, the newest connections real).
  const data = useRecordsData(range, connectedMates, activeMate)
  const loading =
    status === 'loading' || (myMates.status === 'loading' && !myMates.data) || (data.status === 'loading' && !data.data) ||
    isReviewRecordsLoading()
  const failed = myMates.status === 'error' && !myMates.data ? myMates : data.status === 'error' && !data.data ? data : null

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
      setDayCard(null)
      setSearchParams(next)
    },
    [offset, period, searchParams, selectedMateId, setSearchParams],
  )

  /** Another period around the same days (so the board can morph): the new range contains today or this start. */
  const switchPeriod = (nextPeriod: RecordPeriod) => {
    const anchor = range.today >= range.startDay && range.today <= range.endDay ? range.today : range.startDay
    updateParams({ period: nextPeriod, offset: Math.min(0, offsetContaining(nextPeriod, anchor, range.today)) })
  }

  const periodRecords = useMemo(() => data.data?.records ?? [], [data.data])
  const keepsakes = NO_KEEPSAKES

  const isCurrentPeriod = offset === 0
  const summary = data.data ? recordsSummary(data.data.totals, range, isCurrentPeriod, data.data.matesInRange) : null

  // The board: mate colours with 「전체」 (mate by mate in a column), the chosen mate's time-band tints otherwise.
  const yearColumns = yearColumnsFor(stageWidth || 1200)
  const mateIdByCharId = useMemo(() => new Map((connectedMates ?? []).map((mate) => [mate.characterId, mate.id])), [connectedMates])
  const board = useMemo(
    () =>
      buildCapsuleBoard(periodRecords, range, {
        keepsakes,
        mateOf: (record: StudyRecord) => mateIdByCharId.get(record.characterIds[0] ?? '') ?? 'chaerin',
        mateOrder: (connectedMates ?? []).map((mate) => mate.id),
        mateNames: new Map((connectedMates ?? []).map((mate) => [mate.id, mate.name])),
        colorMode: activeMate ? 'band' : 'mate',
        yearColumns,
      }),
    [activeMate, connectedMates, keepsakes, mateIdByCharId, periodRecords, range, yearColumns],
  )
  const capsuleCalendar = board.calendar

  const activeDay =
    (selectedCellKey ? capsuleCalendar.days.find((d) => d.key === selectedCellKey && !d.isFuture) : undefined) ??
    defaultCapsuleDay(capsuleCalendar.days)
  const selectedDay = activeDay ? selectCapsuleDay(periodRecords, activeDay) : null
  const mateNameOf = (record: (typeof periodRecords)[number]) =>
    mateNameByCharId.get(record.characterIds[0] ?? '') ?? record.serverReport?.mate?.name

  // ── Record card of a board day ──
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
  // Only real connections open a record card (a day record has no time of day or connection record behind it).
  const dayCardRecords = dayCard && selectedDay?.day.key === dayCard.key ? selectedDay.records.filter((record) => !isDayRecord(record)) : []
  const dayCardRecord = dayCard ? dayCardRecords[Math.min(dayCard.index, dayCardRecords.length - 1)] : undefined
  const dayCardCapsule = dayCardRecord ? capsuleFromStudyRecord(dayCardRecord) : null
  const dayCardMateId = dayCardRecord ? mateIdByCharId.get(dayCardRecord.characterIds[0] ?? '') : undefined
  // The same keepsakes as the mate's capsules in 내 메이트: milestones of all that mate's connections.
  const dayCardKeepsake = dayCardCapsule ? keepsakes.get(dayCardCapsule.id)?.hours : undefined
  const dayCardView = dayCard && dayCardRecord && dayCardCapsule && (
    <CapsuleRecordCard
      key={dayCard.key}
      capsule={dayCardCapsule}
      mateName={mateNameOf(dayCardRecord) ?? '메이트'}
      mateId={dayCardMateId ?? 'chaerin'}
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

  // Mate comment: the selected mate speaks; with "전체" the mate with most connections in this period (else the one
  // met most recently). It speaks only from what is certain (mate-comment.ts `collectRecordsFacts`): that mate's 38
  // sums and day buckets for this range and 37's first meeting — never a day's sum taken for one connection.
  const views = data.data?.views
  const speaker =
    activeMate ??
    (() => {
      const top = (connectedMates ?? [])
        .map((m) => ({ m, count: views?.[m.id]?.connectionCount ?? 0 }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)[0]?.m
      return top ?? connectedMates?.[0] ?? catalogMates[0] ?? null
    })()
  const speakerCatalog = speaker ? catalogMates.find((m) => m.characterId === speaker.characterId) : undefined
  const speakerMet = speaker ? myMates.byMate.get(speaker.id) : undefined
  const mateComment = speaker && data.data
    ? mateCommentFromFacts(
        collectRecordsFacts({ range, offset, view: views?.[speaker.id] ?? null, met: Boolean(speakerMet), firstMetAt: speakerMet?.firstMetAt ?? null }),
        { range, seedKey: `${state.profile.userId ?? 'guest'}|${speaker.characterId}`, voice: voiceFor(speakerCatalog?.id) },
      )
    : null
  const onCommentProgress = useCallback((progress: number, finished: boolean) => {
    emphasisControl.current?.setProgress(progress, finished)
  }, [])
  const mateCommentView = speaker && mateComment && (
    <MateCommentBubble
      key={mateComment.text}
      comment={mateComment}
      mateName={speaker.name}
      avatarSrc={speakerCatalog ? mateAvatar(speakerCatalog.id, speakerCatalog.image) : undefined}
      onProgress={onCommentProgress}
    />
  )

  const chooseView = (next: BoardView) => {
    const views = { ...boardViews, [boardViewSlot(period)]: next }
    setBoardViews(views)
    storeBoardViews(views)
  }

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
          </div>
          <span className="skeleton-line records-skeleton-panel" aria-hidden="true" />
        </div>
      </RecordsWindowFrame>
    )
  }

  if (failed) {
    return (
      <RecordsWindowFrame>
        <div className="records-block records-empty-box" role="alert">
          <p className="records-empty-title">함께한 기록을 불러오지 못했어요.</p>
          <Button onClick={failed.retry}>다시 시도</Button>
        </div>
      </RecordsWindowFrame>
    )
  }

  if (!connectedMates?.length || !summary) {
    return (
      <RecordsWindowFrame>
        {mateCommentView}
        <div className="records-block records-empty-box">
          <p className="records-empty-title">아직 함께한 기록이 없어요.</p>
          <p className="records-empty-sub">메이트와 연결하면 여기에 쌓여요.</p>
          <ButtonLink to="/">메이트 만나러 가기</ButtonLink>
        </div>
      </RecordsWindowFrame>
    )
  }

  // 「함께한 메이트 n명」: only for 「전체」 with two or more mates.
  const showMateCard = connectedMates.length >= 2 && !activeMate
  const showMateLegend = !activeMate && board.mates.length >= 2

  return (
    <RecordsWindowFrame>
      <div className="records-toolbar">
        <div className="records-period-tabs" role="tablist" aria-label="기록 기간" data-tour="records-periods">
          {recordPeriods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="records-period-tab"
              aria-selected={period === item.id}
              data-period-tab={item.id}
              onClick={() => (item.id === period ? undefined : switchPeriod(item.id))}
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

      {summary.sessions === 0 ? (
        <>
          {mateCommentView}
          <div className="records-block records-empty-box">
            <p className="records-empty-title">이 기간에는 함께한 기록이 없어요.</p>
            <ButtonLink to="/">메이트 만나러 가기</ButtonLink>
          </div>
        </>
      ) : (
        <>
          {/* The comment and the numbers share one row so the board starts on the first screen (1280×720). */}
          <div className="records-overview" data-has-comment={Boolean(mateCommentView) || undefined}>
          {mateCommentView}
          <div className="records-summary-grid" data-tour="records-summary" data-cols={showMateCard ? '4' : '3'}>
            <section className="records-stat-card records-stat-card--primary">
              <BlockTitle icon="clock">{summary.primaryLabel}</BlockTitle>
              <p className="records-stat-value">{duration(summary.primarySeconds)}</p>
              {summary.cameraSeconds > 0 && <p className="records-stat-sub">카메라로 함께한 시간 {duration(summary.cameraSeconds)}</p>}
            </section>
            <section className="records-stat-card">
              <BlockTitle icon="check">함께한 날</BlockTitle>
              <p className="records-stat-value">{summary.activeDays}일</p>
            </section>
            <section className="records-stat-card">
              <BlockTitle icon="video">연결 횟수</BlockTitle>
              <p className="records-stat-value">{summary.sessions}회</p>
            </section>
            {showMateCard && (
              <section className="records-stat-card">
                <BlockTitle icon="user">함께한 메이트</BlockTitle>
                <p className="records-stat-value">{summary.mates}명</p>
              </section>
            )}
          </div>
          </div>

          <section className="records-block records-board-block" aria-labelledby="records-board-title" data-records-board>
            <div className="records-card-head">
              <BlockTitle id="records-board-title" icon="sparkle">
                함께 쌓은 시간
              </BlockTitle>
              <div className="records-board-tools">
                <p className="records-board-legend">
                  {boardView === '2d' ? '칩' : '캡슐'} 1개 = {BOARD.minutesPerCapsule}분
                  {activeMate || board.mates.length < 2 ? ' · 색은 만난 시간대' : ''}
                  {board.hasKeepsake && (
                    <>
                      {' · '}
                      <span aria-hidden="true">✦</span> 기념
                    </>
                  )}
                </p>
                {!boardFallback && (
                  <div className="records-view-toggle" role="group" aria-label="보기 방식" data-tour="records-view">
                    {(['2d', '25d'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="records-view-toggle-btn"
                        aria-pressed={boardView === value}
                        data-board-view={value}
                        onClick={() => chooseView(value)}
                      >
                        {value === '2d' ? '2D' : '2.5D'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {showMateLegend && (
              <ul className="records-board-mates" aria-label="메이트별 캡슐 색">
                {board.mates.map((mate) => {
                  const catalog = catalogMates.find((item) => item.id === mate.mateId)
                  return (
                    <li key={mate.mateId}>
                      {catalog ? (
                        <img src={mateAvatar(catalog.id, catalog.image)} alt="" width={20} height={20} />
                      ) : (
                        <span className="records-board-mate-initial" aria-hidden="true">
                          {mate.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="records-board-mate-swatch" style={{ background: mate.color }} aria-hidden="true" />
                      {mate.name}
                    </li>
                  )
                })}
              </ul>
            )}
            <CapsuleBoard
              model={board}
              view={boardView}
              selectedKey={activeDay?.key}
              emphasis={mateComment?.highlight ?? null}
              onEmphasisControl={onEmphasisControl}
              onStageWidth={setStageWidth}
              onFallback={() => setBoardFallback(true)}
              onController={exposeBoardBenchmark}
              onSelectDay={(day) => {
                setSelectedCellKey(day.key)
                // A day with listed connections opens the same record card as a capsule in 내 메이트.
                if (day.sessions > 0 && periodRecords.some((record) => !isDayRecord(record) && connectionDayKey(record) === day.key)) openDayCard(day.key)
              }}
              onSelectMonth={(month) => {
                const key = `${range.startDay.slice(0, 4)}-${String(month + 1).padStart(2, '0')}-01`
                // A month that has not begun cannot be opened (the board disables it too).
                if (key > range.today) return
                updateParams({ period: 'month', offset: Math.min(0, offsetContaining('month', key, range.today)) })
              }}
            />
            {selectedDay && (
              // Folded away (not removed) in the year, with the board's morph, so the block does not jump.
              <div className="records-day-detail-slot" data-collapsed={board.mode === 'year' || undefined} inert={board.mode === 'year'}>
                <div className="records-day-detail-slot-inner">
                  <CapsuleDayDetail
                    selection={selectedDay}
                    mateNameOf={mateNameOf}
                    renderRecord={(record) =>
                      isDayRecord(record) ? (
                        <DayRemainderRow record={record} mateName={mateNameOf(record)} />
                      ) : (
                        <RecordConnectionRow record={record} mateName={mateNameOf(record)} when="time" />
                      )
                    }
                  />
                </div>
              </div>
            )}
            {dayCardView}
          </section>

          <section className="records-block records-recent-section" aria-labelledby="records-recent-title">
            <BlockTitle id="records-recent-title" icon="book">
              최근 연결
            </BlockTitle>
            {/* 38 lists the newest five connections of the range (no full list or paging). */}
            <ul className="records-row-list">
              {(data.data?.recent ?? []).map((record) => (
                <li key={record.id}>
                  <RecordConnectionRow record={record} mateName={mateNameOf(record)} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </RecordsWindowFrame>
  )
}
