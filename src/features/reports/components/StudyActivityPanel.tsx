import { useState } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import { dayKey, duration } from '@/shared/lib/format'
import { recordSummary, type RecordRange } from '../record-period'
import { ActivityHeatmap } from './ActivityHeatmap'
import { Panel } from '@/shared/ui/Panel'
import './record-summary.css'

export function StudyActivityPanel({
  records,
  range,
  isCurrentPeriod,
  onShiftPeriod,
  onResetPeriod,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
  isCurrentPeriod: boolean
  onShiftPeriod: (direction: -1 | 1) => void
  onResetPeriod: () => void
}) {
  const [selection, setSelection] = useState(range.today)
  const lastDay = range.endDay < range.today ? range.endDay : range.today
  const fallbackDay = lastDay < range.startDay ? range.startDay : lastDay
  const selected =
    selection >= range.startDay && selection <= range.endDay && selection <= range.today
      ? selection
      : fallbackDay
  const selectedRecords = records.filter((record) => dayKey(record.endedAt) === selected)
  const selectedSummary = recordSummary(selectedRecords)
  const selectedLabel = `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일${selected === range.today ? ' · 오늘' : ''}`
  return (
    <Panel bordered={false} className="study-activity-panel" aria-label="달력과 선택한 날짜 기록">
      <ActivityHeatmap
        records={records}
        range={range}
        selected={selected}
        onSelect={setSelection}
        isCurrentPeriod={isCurrentPeriod}
        onShiftPeriod={onShiftPeriod}
        onResetPeriod={onResetPeriod}
      />
      <div
        className="records-selected-day"
        role="group"
        aria-label="선택한 날짜 기록"
        aria-live="polite"
      >
        <p className="records-summary-label">{selectedLabel}</p>
        <strong>{duration(selectedSummary.seconds)}</strong>
        {selectedSummary.sessions ? (
          <dl className="records-selected-stats">
            <div>
              <dt>공부 횟수</dt>
              <dd>
                {selectedSummary.sessions}<small>회</small>
              </dd>
            </div>
            <div>
              <dt>집중률</dt>
              <dd>
                {selectedSummary.focusRate === null ? '—' : <>{selectedSummary.focusRate}<small>%</small></>}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="records-selected-detail">
            {range.startDay > range.today ? '아직 시작되지 않은 기간이에요.' : '아직 기록이 없어요.'}
          </p>
        )}
      </div>
    </Panel>
  )
}
