import type { recordSummary } from '../record-period'
import { duration } from '@/shared/lib/format'
import './record-summary.css'

export function RecordSummary({
  summary,
  label,
  selected,
}: {
  summary: ReturnType<typeof recordSummary>
  label: string
  selected: { label: string; summary: ReturnType<typeof recordSummary> }
}) {
  return (
    <div className="records-summary-header" role="group" aria-label="기간별 공부 요약">
      <div className="records-summary-main">
        <p className="records-summary-label">{label} 공부</p>
        <strong className="records-summary-time">{duration(summary.seconds)}</strong>
        <dl className="records-summary-counts">
          <div>
            <dt>공부 횟수</dt>
            <dd>
              {summary.sessions}
              <small>회</small>
            </dd>
          </div>
          <div>
            <dt>함께한 친구</dt>
            <dd>
              {summary.companions}
              <small>명</small>
            </dd>
          </div>
        </dl>
      </div>
      <div
        className="records-selected-day"
        role="group"
        aria-label="선택한 날짜 기록"
        aria-live="polite"
      >
        <p className="records-summary-label">{selected.label}</p>
        <strong>{duration(selected.summary.seconds)}</strong>
        <p className="records-selected-detail">
          {selected.summary.sessions
            ? `${selected.summary.sessions}회 공부 · 집중률 ${selected.summary.focusRate}%`
            : '아직 기록이 없어요.'}
        </p>
      </div>
    </div>
  )
}
