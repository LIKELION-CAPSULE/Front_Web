import type { recordSummary } from '../record-period'
import { duration } from '@/shared/lib/format'
import './record-summary.css'

export function RecordSummary({
  summary,
  studiedDays,
  label,
}: {
  summary: ReturnType<typeof recordSummary>
  studiedDays: number
  label: string
}) {
  return (
    <div className="records-summary-main" role="group" aria-label="기간별 공부 요약">
      <p className="records-summary-label">{label} 공부</p>
      <strong className="records-summary-time">{duration(summary.seconds)}</strong>
      <p className="records-summary-days">{studiedDays}일 공부</p>
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
  )
}
