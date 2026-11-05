import { useRef, useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { MemoryForm } from './MemoryForm'
import { dayKey } from '@/shared/lib/format'
import { clampCalendarDate } from '@/shared/lib/date-limits'
import { selectSchedule, type SchedulePeriod } from '../schedule-data'
import { ScheduleCalendar } from './ScheduleCalendar'
import { ScheduleListPanel } from './ScheduleListPanel'

export function ScheduleManager({ id = 'account-schedule', initialEditorOpen = false, onBusyChange }: { id?: string; initialEditorOpen?: boolean; onBusyChange?: (busy: boolean) => void } = {}) {
  const { state } = useDemo()
  const today = dayKey()
  const [weekDay, setWeekDay] = useState(() => clampCalendarDate(dayKey()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [period, setPeriod] = useState<SchedulePeriod>('upcoming')
  const [editorOpen, setEditorOpen] = useState(initialEditorOpen)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const memories = selectSchedule(state.memories, period, today).filter(
    (memory) => !selectedDay || memory.date === selectedDay,
  )
  function closeEditor() {
    setEditorOpen(false)
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('.schedule-add')?.focus({ preventScroll: true }))
  }
  function updateBusy(value: boolean) {
    setBusy(value)
    onBusyChange?.(value)
  }
  return (
    <div ref={root} id={id} className="account-schedule">
      <div className="schedule-content">
        <ScheduleCalendar
          memories={state.memories}
          day={weekDay}
          today={today}
          selected={selectedDay}
          disabled={busy}
          onWeekChange={(value) => {
            setWeekDay(clampCalendarDate(value))
            setSelectedDay(null)
          }}
          onSelect={(day) => {
            setSelectedDay(clampCalendarDate(day))
            setPeriod('all')
          }}
        />
        <ScheduleListPanel
          memories={memories}
          today={today}
          period={period}
          selectedDay={selectedDay}
          onPeriodChange={(value) => {
            setPeriod(value)
            setSelectedDay(null)
          }}
          onClearDay={() => setSelectedDay(null)}
          onAdd={() => setEditorOpen(true)}
          editor={editorOpen ? <MemoryForm inline initialDate={selectedDay ?? weekDay} onClose={closeEditor} onBusyChange={updateBusy} onSaved={memory => {
            if (memory.date) setWeekDay(memory.date)
            setPeriod('all')
            if (selectedDay) setSelectedDay(memory.date)
          }} /> : undefined}
        />
      </div>
    </div>
  )
}
