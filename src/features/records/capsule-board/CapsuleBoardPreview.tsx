import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppPanel } from '@/shared/ui/AppPanel'
import { Icon } from '@/shared/ui/Icon'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import type { StudyRecord } from '@/features/demo/types'
import { patternSessions, recordPatternLabels, recordPatterns, type RecordPattern } from '@/features/local-demo/record-patterns'
import { capsuleFromStudyRecord, capsuleRecordsFromStudyRecords } from '@/features/mates/capsule-jar/capsule-jar-data'
import { capsulesForConnection } from '@/features/mates/capsule-jar/capsule-floor-layout'
import { capsuleKeepsakes, type CapsuleKeepsake } from '@/features/mates/capsule-jar/capsule-moments'
import { CapsuleRecordCard } from '@/features/mates/capsule-jar/CapsuleRecordCard'
import { getRecordRange, recordPeriods, recordsInRange, type RecordPeriod } from '@/features/reports/record-period'
import { CapsuleDayDetail } from '../RecordConnectionRow'
import { defaultCapsuleDay, selectCapsuleDay } from '../capsule-calendar'
import { CapsuleBoard } from './CapsuleBoard'
import { BOARD, buildCapsuleBoard } from './capsule-board-layout'
import type { BoardBenchmark } from './capsule-board-scene'
import '@/features/mates/mates.css'
import '@/features/reports/records-window.css'
import './capsule-board-preview.css'

/**
 * Development-only preview of the 「함께 쌓은 시간」 board (`/records?board=preview` in local mock mode; production
 * never loads this module). It generates its own records from the local dummy patterns so the period, pattern and
 * mate can be switched in place.
 */

const SECOND_MATE = { id: 'preview-mate-b', characterId: 'preview-mate-b', name: '메이트 B' }

type PreviewPattern = RecordPattern | 'stress'
const STRESS_LABEL = '연간 꽉 참(성능 측정용)'

/** Every day of the year so far: 1–3 connections of 20–150 minutes in every time band (about 1,500 capsules). */
function stressSessions(now: number) {
  const DAY = 86_400_000
  const year = new Date(now + 9 * 3_600_000).getUTCFullYear()
  const start = Date.UTC(year, 0, 1) - 9 * 3_600_000
  const sessions: { id: number; startedAt: number; endedAt: number; seconds: number }[] = []
  let seed = 7
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let midnight = start, day = 0; midnight + DAY <= now; midnight += DAY, day++) {
    const count = 1 + Math.floor(random() * 3)
    for (let index = 0; index < count; index++) {
      const hour = [1, 7, 13, 19, 22][Math.floor(random() * 5)]!
      const minutes = 20 + Math.floor(random() * 130)
      const startedAt = midnight + (hour + index * 0.1) * 3_600_000
      sessions.push({ id: 880_000_000 + day * 10 + index, startedAt, endedAt: startedAt + minutes * 60_000, seconds: minutes * 60 })
    }
  }
  return sessions.reverse()
}

function previewRecords(pattern: PreviewPattern, now: number, characterId: string, mateName: string, twoMates: boolean): StudyRecord[] {
  const sessions = pattern === 'stress' ? stressSessions(now) : patternSessions(pattern, now)
  return sessions.map((session, index) => {
    const second = twoMates && index % 3 === 1
    const charId = second ? SECOND_MATE.characterId : characterId
    const name = second ? SECOND_MATE.name : mateName
    return {
      id: String(session.id),
      roomId: '1',
      characterIds: [charId],
      tier: 'basic',
      roomName: name,
      characterName: name,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      studySeconds: session.seconds,
      focusSeconds: session.seconds - 60,
      awaySeconds: 60,
      returns: 1,
      cameraFocus: { observedMs: session.seconds * 1000, focusedMs: Math.floor(session.seconds * 0.8) * 1000, returns: 1 },
      completed: false,
      automatic: false,
      serverReport: {
        sessionId: session.id,
        roomName: name,
        character: { id: Number.isFinite(Number(charId)) ? Number(charId) : 0, name },
        startedAt: new Date(session.startedAt).toISOString(),
        endedAt: new Date(session.endedAt).toISOString(),
        endType: 'USER',
        studySeconds: session.seconds,
        presentSeconds: session.seconds - 60,
        awaySeconds: 60,
        returnCount: 1,
      },
    } as StudyRecord
  })
}

declare global {
  interface Window {
    __capsuleBoard?: { benchmark: (durationMs: number) => Promise<BoardBenchmark> }
  }
}

export default function CapsuleBoardPreview() {
  const { home } = useBackend()
  const [now] = useState(Date.now)
  const [period, setPeriod] = useState<RecordPeriod>('week')
  const [pattern, setPattern] = useState<PreviewPattern>('steady')
  const [twoMates, setTwoMates] = useState(false)
  const [mateFilter, setMateFilter] = useState<string | null>(null)
  const [forceReduced, setForceReduced] = useState(false)
  const [replay, setReplay] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [card, setCard] = useState<{ key: string; index: number; phase: 'open' | 'closing' } | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const chaerin = availableMates(home)[0]
  const characterId = chaerin?.characterId ?? '1'
  const mateName = chaerin?.name ?? '채린'
  const records = useMemo(
    () => previewRecords(pattern, now, characterId, mateName, twoMates),
    [pattern, now, characterId, mateName, twoMates],
  )
  const mates = useMemo(
    () => [{ id: chaerin?.id ?? 'chaerin', characterId, name: mateName }, ...(twoMates ? [SECOND_MATE] : [])],
    [chaerin?.id, characterId, mateName, twoMates],
  )
  const activeMate = mateFilter ? mates.find((mate) => mate.id === mateFilter) ?? null : null

  // Keepsakes of every mate over the whole history (내 메이트's rule).
  const keepsakes = useMemo(() => {
    const result = new Map<string, CapsuleKeepsake>()
    for (const mate of mates) {
      const capsules = capsuleRecordsFromStudyRecords(records, mate.characterId, now)
      for (const [id, keepsake] of capsuleKeepsakes(capsules, capsulesForConnection, { now })) result.set(id, keepsake)
    }
    return result
  }, [mates, records, now])

  const range = useMemo(() => getRecordRange(period, now, 0), [period, now])
  const periodRecords = useMemo(() => {
    const inRange = recordsInRange(records, range)
    return activeMate ? inRange.filter((record) => record.characterIds.includes(activeMate.characterId)) : inRange
  }, [records, range, activeMate])
  const model = useMemo(() => buildCapsuleBoard(periodRecords, range, keepsakes), [periodRecords, range, keepsakes])

  const days = model.calendar.days
  const activeDay = (selectedKey ? days.find((day) => day.key === selectedKey && !day.isFuture) : undefined) ?? defaultCapsuleDay(days)
  const selection = activeDay ? selectCapsuleDay(periodRecords, activeDay) : null
  const mateNameOf = (record: StudyRecord) => mates.find((mate) => record.characterIds.includes(mate.characterId))?.name

  // ── Record card (as on the records page) ──
  const closeCard = useCallback(() => {
    setCard((current) => (current && current.phase === 'open' ? { ...current, phase: 'closing' } : current))
  }, [])
  useEffect(() => {
    if (card?.phase !== 'closing') return
    const timer = window.setTimeout(() => {
      setCard(null)
      returnFocus.current?.focus({ preventScroll: true })
      returnFocus.current = null
    }, 240)
    return () => window.clearTimeout(timer)
  }, [card?.phase])
  const cardRecords = card && selection?.day.key === card.key ? selection.records : []
  const cardRecord = card ? cardRecords[Math.min(card.index, cardRecords.length - 1)] : undefined
  const cardCapsule = cardRecord ? capsuleFromStudyRecord(cardRecord) : null

  const onController = useCallback((controller: { benchmark: (ms: number) => Promise<BoardBenchmark> } | null) => {
    if (controller) window.__capsuleBoard = controller
    else delete window.__capsuleBoard
  }, [])

  const reset = (patch: () => void) => {
    patch()
    setSelectedKey(null)
    setCard(null)
  }

  return (
    <AppPanel title="함께 쌓은 시간 시안" hideTitle className="records-window" bodyClassName="records-window-body">
      <div className="capsule-board-preview-controls" aria-label="시안 컨트롤">
        <div className="records-period-tabs" role="tablist" aria-label="기록 기간">
          {recordPeriods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="records-period-tab"
              aria-selected={period === item.id}
              data-period-tab={item.id}
              onClick={() => reset(() => setPeriod(item.id))}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label>
          기록 패턴
          <select
            aria-label="시안 기록 패턴"
            value={pattern}
            onChange={(event) => reset(() => setPattern(event.target.value as PreviewPattern))}
          >
            {recordPatterns.map((value) => (
              <option key={value} value={value}>
                {recordPatternLabels[value]}
              </option>
            ))}
            <option value="stress">{STRESS_LABEL}</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={twoMates} onChange={(event) => reset(() => { setTwoMates(event.target.checked); setMateFilter(null) })} />
          메이트 2명
        </label>
        <label>
          <input type="checkbox" checked={forceReduced} onChange={(event) => setForceReduced(event.target.checked)} data-preview-reduced />
          움직임 줄이기 강제
        </label>
        <button type="button" className="records-mate-chip" onClick={() => setReplay((value) => value + 1)} data-preview-replay>
          다시 재생
        </button>
        <span className="capsule-board-preview-note">{range.dateLabel} · 캡슐 {model.capsuleCount}개</span>
      </div>

      <section className="records-block capsule-board-block" aria-labelledby="capsule-board-title">
        <div className="records-card-head">
          <h2 id="capsule-board-title" className="records-block-title">
            <span className="records-block-title-icon" aria-hidden="true">
              <Icon name="sparkle" size={14} />
            </span>
            함께 쌓은 시간
          </h2>
          {mates.length >= 2 && (
            <nav className="records-mate-chips capsule-board-mates" aria-label="메이트 필터">
              {[{ id: null, name: '전체' }, ...mates].map((mate) => (
                <button
                  key={mate.id ?? 'all'}
                  type="button"
                  className="records-mate-chip"
                  aria-pressed={mateFilter === mate.id}
                  onClick={() => reset(() => setMateFilter(mate.id))}
                >
                  {mate.name}
                </button>
              ))}
            </nav>
          )}
          <p className="capsule-board-legend">
            캡슐 1개 = {BOARD.minutesPerCapsule}분 · 색은 만난 시간대 · <span aria-hidden="true">✦</span> 기념
          </p>
        </div>
        <CapsuleBoard
          model={model}
          selectedKey={activeDay?.key}
          reducedMotion={forceReduced}
          replayToken={replay}
          onController={onController}
          onSelect={(day) => {
            setSelectedKey(day.key)
            if (day.sessions > 0) {
              const active = document.activeElement
              returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null
              setCard({ key: day.key, index: 0, phase: 'open' })
            }
          }}
        />
        {selection && <CapsuleDayDetail selection={selection} mateNameOf={mateNameOf} />}
        {card && cardRecord && cardCapsule && (
          <CapsuleRecordCard
            key={card.key}
            capsule={cardCapsule}
            mateName={mateNameOf(cardRecord) ?? '메이트'}
            mateId={cardRecord.characterIds.includes(characterId) ? chaerin?.id ?? 'chaerin' : SECOND_MATE.id}
            keepsakeHours={keepsakes.get(cardRecord.id)?.hours}
            placement="center"
            phase={card.phase}
            animated={!forceReduced}
            frame="viewport"
            onClose={closeCard}
            pager={{
              index: Math.min(card.index, cardRecords.length - 1),
              count: cardRecords.length,
              onPrevious: () => setCard((current) => (current ? { ...current, index: Math.max(0, current.index - 1) } : current)),
              onNext: () =>
                setCard((current) => (current ? { ...current, index: Math.min(cardRecords.length - 1, current.index + 1) } : current)),
            }}
          />
        )}
      </section>
    </AppPanel>
  )
}
