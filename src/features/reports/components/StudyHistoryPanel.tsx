import type { StudyRecord } from '@/features/demo/types'
import { recordSummary, type RecordRange } from '../record-period'
import { RecordSummary } from './RecordSummary'
import { FocusSummary } from './FocusSummary'
import { SessionList } from './SessionList'
import { dayKey } from '@/shared/lib/format'
import './record-summary.css'

export function StudyHistoryPanel({
  records,
  range,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
}) {
  const summary = recordSummary(records)
  const studiedDays = new Set(records.filter((record) => record.studySeconds > 0).map((record) => dayKey(record.endedAt))).size
  return (
    <section className="records-history-panel" aria-label="기간별 공부와 최근 스터디">
      <div className="records-history-overview">
        <RecordSummary summary={summary} studiedDays={studiedDays} label={range.label} />
        <FocusSummary value={summary.focusRate} label={range.label} />
      </div>
      <div className="records-recent-sessions">
        <h2 className="mb-4 text-sm font-semibold">최근 스터디</h2>
        <SessionList records={records.slice(0, 5)} />
      </div>
    </section>
  )
}
