import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { recordSeconds } from '@/features/demo/selectors'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { StudyHistoryPanel } from '@/features/reports/components/StudyHistoryPanel'
import { CompanionTimeChart } from '@/features/reports/components/CompanionTimeChart'
import { StudyActivityPanel } from '@/features/reports/components/StudyActivityPanel'
import {
  getRecordRange,
  recordsInRange,
  recordPeriods,
  type RecordPeriod,
} from '@/features/reports/record-period'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'
import { duration } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { Panel } from '@/shared/ui/Panel'
import { Tabs } from '@/shared/ui/Tabs'
import { PageHeading } from '@/shared/ui/PageHeading'

export default function RecordsPage() {
  const { state } = useDemo()
  const [view, setView] = useState('all')
  const [period, setPeriod] = useState<RecordPeriod>('week')
  const [offset, setOffset] = useState(0)
  const [now] = useState(Date.now)
  const [roomId, setRoomId] = useState('dawn-library')
  const rooms = getStudyRooms()
  const room = rooms.find((item) => item.id === roomId) ?? rooms[0]!
  const range = getRecordRange(period, now, offset)
  const periodRecords = recordsInRange(state.records, range)
  const records =
    view === 'room' ? periodRecords.filter((record) => record.roomId === room.id) : periodRecords
  const characters = view === 'all' ? rooms.flatMap((item) => item.characters) : room.characters
  const content = (
    <>
      <div className="records-overview-grid">
        <StudyHistoryPanel records={records} range={range} />
        <StudyActivityPanel
          records={records}
          range={range}
          isCurrentPeriod={offset === 0}
          onShiftPeriod={(direction) => setOffset((value) => value + direction)}
          onResetPeriod={() => setOffset(0)}
        />
      </div>
      <Panel bordered={false} className="records-companion-panel min-w-0">
        <CompanionTimeChart
          key={`${view}-${room.id}`}
          records={records}
          characters={characters}
          range={range}
        />
      </Panel>
    </>
  )
  return (
    <>
      <PageHeading title="조금씩 쌓인, 나의 집중" eyebrow={null} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="기록 보기"
          value={view}
          onChange={setView}
          options={[
            { id: 'all', label: '전체' },
            { id: 'room', label: '스터디룸별' },
          ]}
        />
        <Tabs
          label="기록 기간"
          value={period}
          onChange={(value) => {
            setPeriod(value as RecordPeriod)
            setOffset(0)
          }}
          options={recordPeriods}
        />
      </div>
      {view === 'all' ? (
        <div className="records-surface mt-content space-y-content">{content}</div>
      ) : (
        <div className="mt-content grid gap-content lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block" aria-label="내 스터디룸">
            <div className="space-y-3">
              {rooms.map((item) => {
                const sessions = periodRecords.filter((record) => record.roomId === item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => setRoomId(item.id)}
                    aria-pressed={room.id === item.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[16px] p-3 text-left',
                      item.id === room.id ? 'bg-brand-soft' : 'hover:bg-panel',
                    )}
                  >
                    <span className="size-16 shrink-0 overflow-hidden rounded-control bg-placeholder">
                      <RoomArtwork roomId={item.id} variant="thumb" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm">{item.name}</strong>
                      <span className="mt-1 block text-xs text-subtle">
                        {duration(recordSeconds(sessions))} · {sessions.length}회
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>
          <div className="records-surface min-w-0 space-y-content">
            <label className="block text-sm text-muted lg:hidden">
              스터디룸
              <select
                aria-label="스터디룸 선택"
                className="mt-2 block w-full rounded-control border border-transparent bg-panel px-3 py-3 text-ink"
                value={room.id}
                onChange={(event) => setRoomId(event.target.value)}
              >
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <h2 className="text-xl font-semibold tracking-tight">{room.name}</h2>
            {content}
          </div>
        </div>
      )}
    </>
  )
}
