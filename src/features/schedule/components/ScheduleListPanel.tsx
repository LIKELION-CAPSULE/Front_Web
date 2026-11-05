import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Memory } from '@/features/demo/types'
import { Tabs } from '@/shared/ui/Tabs'
import { Panel } from '@/shared/ui/Panel'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { scheduleCountdown, type SchedulePeriod } from '../schedule-data'

export function ScheduleListPanel({
  memories,
  today,
  period,
  selectedDay,
  onPeriodChange,
  onClearDay,
  onAdd,
  editor,
}: {
  memories: readonly Memory[]
  today: string
  period: SchedulePeriod
  selectedDay: string | null
  onPeriodChange: (period: SchedulePeriod) => void
  onClearDay: () => void
  onAdd: () => void
  editor?: ReactNode
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const editing = !!editor
  const empty = memories.length === 0
  useLayoutEffect(() => {
    const content = scroll.current
    if (!content) return
    content.scrollTo({ top: empty ? Math.max(0, content.scrollHeight - content.clientHeight) : 0 })
  }, [selectedDay, period, editing, empty])
  return (
    <Panel bordered={false} density="roomy" className="schedule-details" aria-label="일정 목록">
      {editor ?? <>
        <div ref={scroll} className="schedule-list-scroll" data-empty={empty || undefined} role="group" aria-label="일정 내용" tabIndex={0}>
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
                      {memory.date ? <time dateTime={memory.date}>{memory.date.replaceAll('-', '.')}</time> : <span>마감일 없음</span>}
                      <span>{memory.time || '종일'}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="schedule-kind">{memory.kind}</span>
                      <h3 className="mt-1 type-card-title">{memory.title}</h3>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="schedule-empty text-body-compact text-subtle">
              {selectedDay
                ? '선택한 날짜에는 일정이 없어요.'
                : period === 'past' ? '지난 일정이 없어요.' : '등록된 일정이 없어요.'}
            </p>
          )}
        </div>
        <div className="schedule-list-toolbar">
          <Tabs
            label="일정 기간"
            size="sm"
            value={period}
            onChange={(value) => onPeriodChange(value as SchedulePeriod)}
            options={[
              { id: 'upcoming', label: '예정' },
              { id: 'all', label: '전체' },
              { id: 'past', label: '지난 일정' },
            ]}
          />
          <Button size="sm" className="schedule-add" onClick={onAdd}><Icon name="calendar" size={16} />일정 추가</Button>
        </div>
      </>}
    </Panel>
  )
}
