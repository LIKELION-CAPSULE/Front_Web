import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import type { Memory } from '@/features/demo/types'
import { dayKey } from '@/shared/lib/format'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'

export function MemoryEditor({
  characterId,
  initial,
  onClose,
  onSaved,
  characters,
}: {
  characterId: string
  initial?: Memory
  onClose: () => void
  onSaved?: () => void
  characters?: readonly { id: string; name: string }[]
}) {
  const { dispatch } = useDemo()
  const [kind, setKind] = useState<Memory['kind']>(initial?.kind ?? '시험')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? dayKey())
  const [time, setTime] = useState(initial?.time ?? '20:00')
  const [rememberedBy, setRememberedBy] = useState(initial?.characterId ?? characterId)
  return (
    <Dialog open onClose={onClose} title={initial ? '일정 수정' : '일정 추가'}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          dispatch({
            type: 'MEMORY',
            memory: {
              id: initial?.id ?? `memory-${crypto.randomUUID()}`,
              characterId: rememberedBy,
              kind,
              title: title.trim(),
              date,
              time: kind === '약속' ? time : '',
            },
          })
          onSaved?.()
          onClose()
        }}
        className="space-y-4"
      >
        {characters && (
          <label className="block text-sm">
            기억할 캐릭터
            <select
              required
              aria-label="기억할 캐릭터"
              value={rememberedBy}
              onChange={(event) => setRememberedBy(event.target.value)}
              className="form-input mt-2"
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          종류
          <select
            aria-label="종류"
            value={kind}
            onChange={(event) => setKind(event.target.value as Memory['kind'])}
            className="form-input mt-2"
          >
            <option>시험</option>
            <option>목표</option>
            <option>약속</option>
          </select>
        </label>
        <label className="block text-sm">
          이름
          <input
            required
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="form-input mt-2"
            placeholder="예: 영어 시험"
          />
        </label>
        <label className="block text-sm">
          날짜
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="form-input mt-2"
          />
        </label>
        {kind === '약속' && (
          <label className="block text-sm">
            시간
            <input
              required
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="form-input mt-2"
            />
          </label>
        )}
        <div className="flex gap-3">
          {initial && (
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'DELETE_MEMORY', id: initial.id })
                onClose()
              }}
            >
              삭제하기
            </Button>
          )}
          <Button type="submit" disabled={!title.trim()} className="flex-1">
            저장하기
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
