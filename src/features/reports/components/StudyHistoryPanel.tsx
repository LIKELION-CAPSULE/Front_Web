import type { StudyRecord } from '@/features/demo/types'
import { type RecordRange } from '../record-period'
import { cameraRecords, connectionSummary } from '../connection-records'
import { RecordSummary } from './RecordSummary'
import { SessionList } from './SessionList'
import { dayKey } from '@/shared/lib/format'
import { Panel } from '@/shared/ui/Panel'
import './record-summary.css'

export function StudyHistoryPanel({
  records,
  range,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
}) {
  const summary = connectionSummary(records)
  const studiedDays = summary.cameraSeconds === null ? null : new Set(cameraRecords(records).filter(record => record.studySeconds > 0).map(record => dayKey(record.endedAt))).size
  return (
    <Panel bordered={false} className="records-history-panel" aria-label="연결 요약과 최근 기록">
      <div className="records-history-overview">
        <RecordSummary summary={summary} studiedDays={studiedDays} label={range.label} />
      </div>
      <div className="records-recent-sessions">
        <h2 className="mb-4 type-card-title">최근 연결 기록</h2>
        <SessionList records={records.slice(0, 5)} />
      </div>
    </Panel>
  )
}
