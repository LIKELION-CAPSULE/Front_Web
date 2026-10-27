import { useMemo } from 'react'
import type { Memory } from '@/features/demo/types'
import { Icon } from '@/shared/ui/Icon'
import { scheduleMonthDays, shiftScheduleMonth } from '../schedule-data'

export function ScheduleCalendar({
  memories,
  month,
  today,
  selected,
  onMonthChange,
  onSelect,
}: {
  memories: readonly Memory[]
  month: string
  today: string
  selected: string | null
  onMonthChange: (month: string) => void
  onSelect: (day: string) => void
}) {
  const year = Number(month.slice(0, 4))
  const currentYear = Number(today.slice(0, 4))
  const years = [
    ...new Set([
      ...Array.from({ length: 21 }, (_, index) => currentYear - 10 + index),
      ...memories.map((memory) => Number(memory.date.slice(0, 4))),
      year,
    ]),
  ]
    .filter((value) => Number.isInteger(value) && value > 0 && value < 10000)
    .sort((a, b) => a - b)
  const cells = useMemo(
    () => scheduleMonthDays(month, { weekStartsOn: 0, showOutsideDays: true }),
    [month],
  )
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const memory of memories) result.set(memory.date, (result.get(memory.date) ?? 0) + 1)
    return result
  }, [memories])
  return (
    <div className="schedule-calendar" role="region" aria-label="일정 달력">
      <div className="schedule-calendar-heading">
        <button
          type="button"
          onClick={() => {
            onMonthChange(today.slice(0, 7))
            onSelect(today)
          }}
        >
          오늘
        </button>
      </div>
      <div className="schedule-calendar-navigation">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => onMonthChange(shiftScheduleMonth(month, -1))}
        >
          <Icon name="chevron" size={16} className="rotate-180" />
        </button>
        <div className="schedule-calendar-selects">
          <label className="schedule-calendar-dropdown">
            <select
              aria-label="일정 월"
              value={Number(month.slice(5))}
              onChange={(event) =>
                onMonthChange(`${month.slice(0, 4)}-${event.target.value.padStart(2, '0')}`)
              }
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1}월</option>
              ))}
            </select>
            <Icon name="chevronsVertical" size={13} />
          </label>
          <label className="schedule-calendar-dropdown">
            <select
              aria-label="일정 연도"
              value={year}
              onChange={(event) =>
                onMonthChange(`${event.target.value.padStart(4, '0')}-${month.slice(5)}`)
              }
            >
              {years.map((value) => <option key={value} value={value}>{value}년</option>)}
            </select>
            <Icon name="chevronsVertical" size={13} />
          </label>
        </div>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => onMonthChange(shiftScheduleMonth(month, 1))}
        >
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <div className="schedule-calendar-weekdays" aria-hidden="true">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div
        className="schedule-calendar-grid"
        role="group"
        aria-label={`${year}년 ${Number(month.slice(5))}월 일정`}
      >
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} aria-hidden="true" />
          const count = counts.get(day) ?? 0
          const outside = !day.startsWith(month)
          return (
            <button
              key={day}
              type="button"
              className="schedule-calendar-day"
              data-day={day}
              data-today={day === today}
              data-outside={outside}
              data-has-events={count > 0}
              aria-current={day === today ? 'date' : undefined}
              aria-pressed={day === selected}
              aria-label={`${day.replaceAll('-', '.')} · 일정 ${count}개`}
              onClick={() => {
                if (outside) onMonthChange(day.slice(0, 7))
                onSelect(day)
              }}
            >
              <span>{Number(day.slice(8))}</span>
              {count > 0 && (
                <span
                  className={`schedule-calendar-marker${count > 1 ? ' is-count' : ''}`}
                  aria-hidden="true"
                >
                  {count > 1 ? count : null}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
