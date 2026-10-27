import { useId, useMemo } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import type { RecordRange } from '@/features/reports/record-period'
import { studyHeatmap } from '../heatmap-data'
import { StudyHeatmap } from './StudyHeatmap'

export function ActivityHeatmap({
  records,
  range,
  selected,
  onSelect,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
  selected: string
  onSelect: (day: string) => void
}) {
  const { period } = range
  const heading = useId()
  const data = useMemo(() => studyHeatmap(records, range), [records, range])
  return (
    <div className="activity-calendar" aria-labelledby={heading} data-period={period}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={heading} className="text-sm font-semibold">
          집중이 쌓이는 달력
        </h2>
        <span className="activity-summary">
          {range.dateLabel} · {data.attended}일 공부
        </span>
      </div>
      <StudyHeatmap key={period} data={data} selected={selected} onSelect={onSelect} />
    </div>
  )
}
