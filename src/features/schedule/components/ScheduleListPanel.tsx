import type { Memory } from '@/features/demo/types'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { Icon } from '@/shared/ui/Icon'
import { Panel } from '@/shared/ui/Panel'
import { scheduleCountdown, type SchedulePeriod } from '../schedule-data'

export function ScheduleListPanel({
  memories,
  today,
  period,
  selectedDay,
  onPeriodChange,
  onClearDay,
  onAdd,
  onEdit,
}: {
  memories: readonly Memory[]
  today: string
  period: SchedulePeriod
  selectedDay: string | null
  onPeriodChange: (period: SchedulePeriod) => void
  onClearDay: () => void
  onAdd: () => void
  onEdit: (memory: Memory) => void
}) {
  return (
    <Panel bordered={false} density="roomy" className="schedule-details" aria-labelledby="schedule-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="schedule-heading" className="text-section-title font-semibold">
          일정
        </h2>
        <Button size="sm" onClick={onAdd}>
          <Icon name="calendar" size={16} motion="draw" />
          일정 추가
        </Button>
      </div>
      <div className="my-6">
        <Tabs
          label="일정 기간"
          value={period}
          onChange={(value) => onPeriodChange(value as SchedulePeriod)}
          options={[
            { id: 'upcoming', label: '예정' },
            { id: 'all', label: '전체' },
            { id: 'past', label: '지난' },
          ]}
        />
      </div>
      {selectedDay && (
        <div className="schedule-selected-date">
          <h3>{selectedDay.replaceAll('-', '.')}</h3>
          <button type="button" onClick={onClearDay}>
            전체 일정 보기
          </button>
        </div>
      )}
      {memories.length ? (
        <ul className="schedule-list">
          {memories.map((memory) => {
            const countdown = scheduleCountdown(memory.date, today)
            return (
              <li key={memory.id} className="schedule-row">
                <div className="schedule-date">
                  {countdown && <span className="schedule-countdown">{countdown}</span>}
                  <time dateTime={memory.date}>{memory.date.replaceAll('-', '.')}</time>
                  <span>{memory.time || '종일'}</span>
                </div>
                <div className="min-w-0">
                  <span className="schedule-kind">{memory.kind}</span>
                  <h3 className="mt-1 text-sm font-semibold">{memory.title}</h3>
                </div>
                <button
                  type="button"
                  className="schedule-edit"
                  aria-label={`${memory.title} 수정`}
                  onClick={() => onEdit(memory)}
                >
                  수정
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-12 text-center text-sm text-subtle">
          {selectedDay
            ? '선택한 날짜에는 일정이 없어요.'
            : period === 'past' ? '지난 일정이 없어요.' : '등록된 일정이 없어요.'}
        </p>
      )}
    </Panel>
  )
}
