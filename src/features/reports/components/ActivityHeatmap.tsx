import { useId, useMemo } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import type { RecordRange } from '@/features/reports/record-period'
import { studyHeatmap } from '../heatmap-data'
import { StudyHeatmap } from './StudyHeatmap'
import { Icon } from '@/shared/ui/Icon'

export function ActivityHeatmap({
  records,
  range,
  selected,
  onSelect,
  isCurrentPeriod,
  onShiftPeriod,
  onResetPeriod,
}: {
  records: readonly StudyRecord[]
  range: RecordRange
  selected: string
  onSelect: (day: string) => void
  isCurrentPeriod: boolean
  onShiftPeriod: (direction: -1 | 1) => void
  onResetPeriod: () => void
}) {
  const { period } = range
  const heading = useId()
  const data = useMemo(() => studyHeatmap(records, range), [records, range])
  return (
    <div className="activity-calendar" aria-labelledby={heading} data-period={period}>
      <div className="activity-calendar-heading">
        <h2 id={heading} className="text-sm font-semibold">
          집중이 쌓이는 달력
        </h2>
        <div className="activity-calendar-tools">
          {period === 'year' ? (
            <span className="activity-summary">{range.dateLabel}</span>
          ) : (
            <>
              <div className="records-period-navigation" role="group" aria-label="기록 기간 이동">
                {!isCurrentPeriod && (
                  <button type="button" className="records-period-reset" onClick={onResetPeriod}>
                    {period === 'week' ? '이번 주' : '이번 달'}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={period === 'week' ? '이전 주' : '이전 달'}
                  onClick={() => onShiftPeriod(-1)}
                >
                  <Icon name="chevron" size={17} className="rotate-180" />
                </button>
                <span className="activity-summary" aria-live="polite">
                  {range.dateLabel}
                </span>
                <button
                  type="button"
                  aria-label={period === 'week' ? '다음 주' : '다음 달'}
                  onClick={() => onShiftPeriod(1)}
                >
                  <Icon name="chevron" size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <StudyHeatmap key={`${period}-${range.startDay}`} data={data} selected={selected} onSelect={onSelect} />
    </div>
  )
}
