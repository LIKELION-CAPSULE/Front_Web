import { useState } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import { dayKey } from '@/shared/lib/format'
import { recordSummary, type RecordRange } from '../record-period'
import { RecordSummary } from './RecordSummary'
import { ActivityHeatmap } from './ActivityHeatmap'

export function StudyActivityPanel({
  records,
  range,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
}) {
  const [selection, setSelection] = useState(range.today)
  const selected =
    selection >= range.startDay && selection <= range.endDay && selection <= range.today
      ? selection
      : range.today
  const selectedRecords = records.filter((record) => dayKey(record.endedAt) === selected)
  const selectedLabel = `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일${selected === range.today ? ' · 오늘' : ''}`
  return (
    <section className="study-activity-panel" aria-label="공부 요약과 달력">
      <RecordSummary
        summary={recordSummary(records)}
        label={range.label}
        selected={{ label: selectedLabel, summary: recordSummary(selectedRecords) }}
      />
      <ActivityHeatmap
        records={records}
        range={range}
        selected={selected}
        onSelect={setSelection}
      />
    </section>
  )
}
