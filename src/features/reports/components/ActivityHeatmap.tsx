import { useId, useMemo } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import type { RecordRange } from '@/features/reports/record-period'
import { studyHeatmap } from '../heatmap-data'
import { StudyHeatmap } from './StudyHeatmap'
import { Icon } from '@/shared/ui/Icon'
import { MIN_CALENDAR_DATE } from '@/shared/lib/date-limits'

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
  const navigation = period === 'week' ? { previous: '이전 주', next: '다음 주', reset: '이번 주' }
    : period === 'month' ? { previous: '이전 달', next: '다음 달', reset: '이번 달' }
      : { previous: '이전 해', next: '다음 해', reset: '올해' }
  return (
    <div className="activity-calendar" aria-labelledby={heading} data-period={period}>
      <div className="activity-calendar-heading">
        <h2 id={heading} className="type-card-title">
          함께한 날
        </h2>
        <div className="activity-calendar-tools">
              <div className="records-period-navigation" role="group" aria-label="기록 기간 이동">
                {!isCurrentPeriod && (
                  <button type="button" className="records-period-reset" onClick={onResetPeriod}>
                    {navigation.reset}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={navigation.previous}
                  disabled={range.startDay <= MIN_CALENDAR_DATE}
                  onClick={() => onShiftPeriod(-1)}
                >
                  <Icon name="chevron" size={17} className="rotate-180" />
                </button>
                <span className="activity-summary" aria-live="polite">
                  {range.dateLabel}
                </span>
                <button
                  type="button"
                  aria-label={navigation.next}
                  onClick={() => onShiftPeriod(1)}
                >
                  <Icon name="chevron" size={17} />
                </button>
              </div>
        </div>
      </div>
      <StudyHeatmap key={`${period}-${range.startDay}`} data={data} selected={selected} onSelect={onSelect} />
    </div>
  )
}
