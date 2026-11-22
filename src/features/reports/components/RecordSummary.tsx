import type { connectionSummary } from '../connection-records'
import { measuredDuration as duration } from '@/shared/lib/format'
import './record-summary.css'

export function RecordSummary({
  summary,
  studiedDays,
  label,
}: {
  summary: ReturnType<typeof connectionSummary>
  studiedDays: number | null
  label: string
}) {
  return (
    <div className="records-summary-main" role="group" aria-label="기간별 연결 요약">
      <p className="records-summary-label">{label} 함께한 시간</p>
      <strong className="records-summary-time">{summary.cameraSeconds === null ? '—' : duration(summary.cameraSeconds)}</strong>
      <p className="records-summary-days">{studiedDays === null ? '—' : `${studiedDays}일 함께함`}</p>
      <p className="records-summary-days">연결 시간 {summary.connectionSeconds === null ? '—' : duration(summary.connectionSeconds)}</p>
      <dl className="records-summary-counts">
        <div>
          <dt>연결 횟수</dt>
          <dd>
            {summary.sessions === null ? '—' : <>{summary.sessions}<small>회</small></>}
          </dd>
        </div>
        <div>
          <dt>함께한 메이트</dt>
          <dd>
            {summary.mates === null ? '—' : <>{summary.mates}<small>명</small></>}
          </dd>
        </div>
      </dl>
    </div>
  )
}
