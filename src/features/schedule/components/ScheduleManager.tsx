import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import type { Memory } from '@/features/demo/types'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { MemoryEditor } from '@/features/characters/components/MemoryEditor'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { dayKey } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { selectSchedule, type SchedulePeriod } from '../schedule-data'

export function ScheduleManager() {
  const { state, dispatch } = useDemo()
  const [params, setParams] = useSearchParams()
  const rooms = getStudyRooms()
  const characters = rooms.flatMap((room) => room.characters)
  const requested = params.get('character')
  const filter = characters.some((character) => character.id === requested) ? requested! : 'all'
  const [period, setPeriod] = useState<SchedulePeriod>('upcoming')
  const [editor, setEditor] = useState<Memory | 'new' | null>(() =>
    params.get('add') === '1' ? 'new' : null,
  )
  const memories = selectSchedule(state.memories, filter, period, dayKey())
  function closeEditor() {
    setEditor(null)
    if (params.has('add')) {
      const next = new URLSearchParams(params)
      next.delete('add')
      setParams(next, { replace: true, preventScrollReset: true })
    }
  }
  return (
    <section id="schedule" className="mypage-schedule" aria-labelledby="schedule-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="schedule-heading" className="text-lg font-semibold">
          일정
        </h2>
        <Button className="min-h-10 px-4 py-2 text-sm" onClick={() => setEditor('new')}>
          일정 추가
        </Button>
      </div>
      <div className="my-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="일정 기간"
          value={period}
          onChange={(value) => setPeriod(value as SchedulePeriod)}
          options={[
            { id: 'upcoming', label: '예정' },
            { id: 'all', label: '전체' },
            { id: 'past', label: '지난' },
          ]}
        />
        <label className="flex items-center gap-3 text-xs text-muted">
          캐릭터
          <select
            aria-label="캐릭터"
            className="rounded-control bg-surface px-3 py-2.5 text-sm text-ink"
            value={filter}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              if (event.target.value === 'all') next.delete('character')
              else next.set('character', event.target.value)
              setParams(next, { preventScrollReset: true })
            }}
          >
            <option value="all">모든 캐릭터</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {memories.length ? (
        <ul className="schedule-list">
          {memories.map((memory) => {
            const character = characters.find((item) => item.id === memory.characterId)
            return (
              <li key={memory.id} className="schedule-row">
                <div className="schedule-date">
                  <time dateTime={memory.date}>{memory.date.replaceAll('-', '.')}</time>
                  <span>{memory.time || '종일'}</span>
                </div>
                <div className="min-w-0">
                  <span className="schedule-kind">{memory.kind}</span>
                  <h3 className="mt-1 text-sm font-semibold">{memory.title}</h3>
                </div>
                <div className="schedule-companion">
                  <CharacterAvatar characterId={memory.characterId} />
                  <span>{character?.name ?? '캐릭터'}</span>
                </div>
                <button
                  className="schedule-edit"
                  aria-label={`${memory.title} 수정`}
                  onClick={() => setEditor(memory)}
                >
                  수정
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-12 text-center text-sm text-subtle">
          {period === 'past' ? '지난 일정이 없어요.' : '등록된 일정이 없어요.'}
        </p>
      )}
      {editor && (
        <MemoryEditor
          key={editor === 'new' ? 'new' : editor.id}
          characterId={filter === 'all' ? characters[0]!.id : filter}
          characters={characters}
          initial={editor === 'new' ? undefined : editor}
          onClose={closeEditor}
          onSaved={() => {
            const roomId = params.get('fromRoom')
            if (roomId && rooms.some((room) => room.id === roomId))
              dispatch({ type: 'EXAM_PROMPTED', roomId })
          }}
        />
      )}
    </section>
  )
}
