import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import type { Memory } from '@/features/demo/types'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { MemoryEditor } from './MemoryEditor'
import { dayKey } from '@/shared/lib/format'
import { selectSchedule, type SchedulePeriod } from '../schedule-data'
import { ScheduleCalendar } from './ScheduleCalendar'
import { ScheduleListPanel } from './ScheduleListPanel'

export function ScheduleManager() {
  const { state, dispatch } = useDemo()
  const [params, setParams] = useSearchParams()
  const rooms = getStudyRooms()
  const today = dayKey()
  const [month, setMonth] = useState(() => dayKey().slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [period, setPeriod] = useState<SchedulePeriod>('upcoming')
  const [editor, setEditor] = useState<Memory | 'new' | null>(() =>
    params.get('add') === '1' ? 'new' : null,
  )
  const memories = selectSchedule(state.memories, period, today).filter(
    (memory) => !selectedDay || memory.date === selectedDay,
  )
  function closeEditor() {
    setEditor(null)
    if (params.has('add')) {
      const next = new URLSearchParams(params)
      next.delete('add')
      setParams(next, { replace: true, preventScrollReset: true })
    }
  }
  return (
    <div id="schedule" className="mypage-schedule">
      <ScheduleCalendar
        memories={state.memories}
        month={month}
        today={today}
        selected={selectedDay}
        onMonthChange={(value) => {
          setMonth(value)
          setSelectedDay(null)
        }}
        onSelect={(day) => {
          setSelectedDay(day)
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
        onAdd={() => setEditor('new')}
        onEdit={setEditor}
      />
      {editor && (
        <MemoryEditor
          key={editor === 'new' ? 'new' : editor.id}
          initial={editor === 'new' ? undefined : editor}
          initialDate={selectedDay ?? undefined}
          onClose={closeEditor}
          onSaved={(memory) => {
            setMonth(memory.date.slice(0, 7))
            if (selectedDay) setSelectedDay(memory.date)
            const roomId = params.get('fromRoom')
            if (roomId && rooms.some((room) => room.id === roomId))
              dispatch({ type: 'EXAM_PROMPTED', roomId })
          }}
        />
      )}
    </div>
  )
}
