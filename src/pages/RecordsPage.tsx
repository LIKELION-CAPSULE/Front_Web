import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { recordSeconds } from '@/features/demo/selectors'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { SessionList } from '@/features/reports/components/SessionList'
import { TimeBars } from '@/features/reports/components/TimeBars'
import { dayKey, duration } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { Panel, StatCard } from '@/shared/ui/Panel'
import { Tabs } from '@/shared/ui/Tabs'
import { Badge } from '@/shared/ui/Badge'
import { PageHeading } from '@/shared/ui/PageHeading'
import { Icon } from '@/shared/ui/Icon'
import { ActivityHeatmap } from '@/features/reports/components/ActivityHeatmap'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'

export default function RecordsPage() {
  const { state } = useDemo()
  const [view, setView] = useState('all')
  const [roomId, setRoomId] = useState('dawn-library')
  const rooms = getStudyRooms()
  const room = rooms.find((item) => item.id === roomId) ?? rooms[0]!
  const today = dayKey()
  const startToday = new Date(`${today}T00:00:00+09:00`).getTime()
  const weekday = new Date(`${today}T12:00:00+09:00`).getUTCDay()
  const startWeek = startToday - ((weekday + 6) % 7) * 86400000
  const records =
    view === 'room' ? state.records.filter((record) => record.roomId === room.id) : state.records
  const week = records.filter((record) => record.endedAt >= startWeek)
  const visited = new Set(week.map((record) => dayKey(record.endedAt)))
  const stats =
    view === 'all'
      ? [
          {
            label: '오늘',
            value: duration(
              recordSeconds(records.filter((record) => dayKey(record.endedAt) === today)),
            ),
          },
          { label: '이번 주', value: duration(recordSeconds(week)) },
          {
            label: '이번 달',
            value: duration(
              recordSeconds(
                records.filter(
                  (record) => dayKey(record.endedAt).slice(0, 7) === today.slice(0, 7),
                ),
              ),
            ),
          },
          { label: '누적', value: duration(recordSeconds(records)) },
        ]
      : [
          { label: '이 룸 누적', value: duration(recordSeconds(records)) },
          { label: '이번 주', value: duration(recordSeconds(week)) },
          { label: '세션', value: `${records.length}회` },
          { label: '이번 주 이용일', value: `${visited.size}일` },
        ]
  const characters =
    view === 'all' ? rooms.flatMap((item) => item.characters).slice(0, 3) : room.characters
  const bars = characters.map((character) => ({
    id: character.id,
    name: character.name,
    seconds: records
      .filter((record) => record.characterIds.includes(character.id))
      .reduce(
        (sum, record) => sum + Math.round(record.studySeconds / record.characterIds.length),
        0,
      ),
  }))
  const statGrid = (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
  return (
    <>
      <PageHeading title="조금씩 쌓인, 나의 집중">
        혼자였다면 지나쳤을 시간. 함께 쌓아 온 순간들을 돌아봐요.
      </PageHeading>
      <Tabs
        label="기록 보기"
        value={view}
        onChange={setView}
        options={[
          { id: 'all', label: '전체' },
          { id: 'room', label: '스터디룸별' },
        ]}
      />
      {view === 'all' ? (
        <div className="mt-6 space-y-5">
          {statGrid}
          <ActivityHeatmap records={records} />
          <div className="grid gap-5 lg:grid-cols-[5fr_7fr]">
            <Panel title="이번 주 이용일">
              <div className="flex items-center gap-3">
                <strong className="text-[28px]">{visited.size}일 / 7일</strong>
                <Badge>꾸준히 쌓아 가요</Badge>
              </div>
              <div className="mt-4 flex justify-between gap-1 sm:justify-start sm:gap-3">
                {['월', '화', '수', '목', '금', '토', '일'].map((label, index) => {
                  const key = dayKey(startWeek + index * 86400000 + 12 * 3600000)
                  return (
                    <div key={label} className="text-center">
                      <span
                        className={cn(
                          'block size-7 rounded-full border',
                          visited.has(key)
                            ? 'border-brand bg-brand-solid'
                            : key === today
                              ? 'border-2 border-brand'
                              : 'border-line',
                        )}
                      >
                        {visited.has(key) && (
                          <Icon name="check" size={14} className="m-auto mt-1.5 text-white" />
                        )}
                      </span>
                      <span className="mt-1 block text-[10px] text-subtle">{label}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
            <Panel title="캐릭터별 함께한 시간">
              <TimeBars values={bars} />
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-[2.1fr_1fr]">
            <Panel title="최근 스터디">
              <SessionList records={records.slice(0, 3)} />
            </Panel>
            <Panel title="주간 랭킹" className="border-dashed">
              <p className="mt-3 text-xl font-bold text-subtle">다음에 만나요</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                지금은 나의 공부에 집중해요.
                <br />
                주간 랭킹은 추후 제공할 예정이에요.
              </p>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-7 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside>
            <p className="mb-3 text-sm text-subtle">내 스터디룸</p>
            <div className="space-y-3">
              {rooms.map((item) => {
                const sessions = state.records.filter((record) => record.roomId === item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => setRoomId(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[16px] border p-3 text-left',
                      item.id === room.id ? 'border-2 border-brand bg-brand-soft' : 'border-line',
                    )}
                  >
                    <span className="size-16 shrink-0 overflow-hidden rounded-control bg-placeholder">
                      <RoomArtwork roomId={item.id} variant="thumb" />
                    </span>
                    <span>
                      <strong className="block">{item.name}</strong>
                      <span className="mt-1 block text-xs text-muted">
                        1:{item.characters.length} ·{' '}
                        {item.characters.map((character) => character.name).join(' · ')}
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {duration(recordSeconds(sessions))} · {sessions.length}회
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <h2 className="text-[26px] font-bold">{room.name}</h2>
              <Badge>
                1:{room.characters.length} 룸 ·{' '}
                {room.characters.map((character) => character.name).join(' · ')}
              </Badge>
            </div>
            {statGrid}
            <div className="mt-5">
              <ActivityHeatmap records={records} />
            </div>
            <Panel title="이 룸에서 캐릭터별 함께한 시간" className="mt-4">
              <TimeBars values={bars} />
              <p className="mt-4 text-[11px] leading-5 text-subtle">
                캐릭터별 시간은 데모 참여 비율을 적용한 예시예요.
              </p>
            </Panel>
            <Panel title="이 룸 최근 스터디" className="mt-4">
              <SessionList records={records.slice(0, 3)} />
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}
