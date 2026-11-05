import { useMemo } from 'react'
import type { Memory } from '@/features/demo/types'
import { Icon } from '@/shared/ui/Icon'
import { Panel } from '@/shared/ui/Panel'
import { MIN_CALENDAR_DATE } from '@/shared/lib/date-limits'
import { scheduleWeekDays, shiftScheduleWeek } from '../schedule-data'

export function ScheduleCalendar({ memories, day, today, selected, disabled = false, onWeekChange, onSelect }: {
  memories: readonly Memory[]
  day: string
  today: string
  selected: string | null
  disabled?: boolean
  onWeekChange: (day: string) => void
  onSelect: (day: string) => void
}) {
  const cells = scheduleWeekDays(day)
  const start = cells.find(value => value >= MIN_CALENDAR_DATE)!
  const end = cells[6]!
  const range = `${start.replaceAll('-', '.')} – ${end.slice(start.slice(0, 4) === end.slice(0, 4) ? 5 : 0).replaceAll('-', '.')}`
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const memory of memories) result.set(memory.date, (result.get(memory.date) ?? 0) + 1)
    return result
  }, [memories])
  return <Panel bordered={false} className="schedule-calendar" role="region" aria-label="주간 일정 달력">
    <div className="schedule-calendar-heading">
      <div className="schedule-calendar-navigation">
        <button type="button" aria-label="이전 주" disabled={disabled || cells[0]! <= MIN_CALENDAR_DATE} onClick={() => onWeekChange(shiftScheduleWeek(day, -1))}><Icon name="chevron" size={16} className="rotate-180" /></button>
        <p className="schedule-calendar-range" aria-live="polite" aria-atomic="true">{range}</p>
        <button type="button" aria-label="다음 주" disabled={disabled} onClick={() => onWeekChange(shiftScheduleWeek(day, 1))}><Icon name="chevron" size={16} /></button>
      </div>
      <button type="button" disabled={disabled} onClick={() => { onWeekChange(today); onSelect(today) }}>오늘</button>
    </div>
    <div className="schedule-calendar-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(label => <span key={label}>{label}</span>)}</div>
    <div className="schedule-calendar-grid" role="group" aria-label={`${range} 주간 일정`}>
      {cells.map(date => {
        if (date < MIN_CALENDAR_DATE) return <span key={date} aria-hidden="true" />
        const count = counts.get(date) ?? 0
        return <button key={date} type="button" disabled={disabled} className="schedule-calendar-day" data-day={date} data-today={date === today} data-has-events={count > 0} aria-current={date === today ? 'date' : undefined} aria-pressed={date === selected} aria-label={`${date.replaceAll('-', '.')} · 일정 ${count}개`} onClick={() => onSelect(date)}>
          <span>{Number(date.slice(8))}</span>
          {count > 0 && <span className={`schedule-calendar-marker${count > 1 ? ' is-count' : ''}`} aria-hidden="true">{count > 1 ? count : null}</span>}
        </button>
      })}
    </div>
  </Panel>
}
