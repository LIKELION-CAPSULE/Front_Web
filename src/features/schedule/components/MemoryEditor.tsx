import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import type { Memory } from '@/features/demo/types'
import { dayKey } from '@/shared/lib/format'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import { WheelSelectField } from '@/shared/ui/WheelSelectField'
import { FormField } from '@/shared/ui/FormField'

const kindOptions = (['시험', '목표', '약속'] as const).map((value) => ({ value, label: value }))

export function MemoryEditor({
  initial,
  initialDate,
  onClose,
  onSaved,
}: {
  initial?: Memory
  initialDate?: string
  onClose: () => void
  onSaved?: (memory: Memory) => void
}) {
  const { dispatch } = useDemo()
  const [kind, setKind] = useState<Memory['kind']>(initial?.kind ?? '시험')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? initialDate ?? dayKey())
  const [time, setTime] = useState(initial?.time || '20:00')
  const [openField, setOpenField] = useState<'kind' | 'date' | 'time' | null>(null)
  return (
    <Dialog open onClose={onClose} title={initial ? '일정 수정' : '일정 추가'}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const memory = {
            id: initial?.id ?? `memory-${crypto.randomUUID()}`,
            kind,
            title: title.trim(),
            date,
            time: kind === '약속' ? time : '',
          }
          dispatch({ type: 'MEMORY', memory })
          onSaved?.(memory)
          onClose()
        }}
        className="space-y-4 [--form-input-border:var(--color-line)]"
      >
        <WheelSelectField
          label="종류"
          options={kindOptions}
          value={kind}
          onChange={setKind}
          open={openField === 'kind'}
          onOpenChange={(open) => setOpenField(open ? 'kind' : null)}
        />
        <FormField label="이름">
          <input
            required
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="form-input"
            placeholder="예: 영어 시험"
          />
        </FormField>
        <DateTimeWheelField
          label="날짜"
          mode="date"
          value={date}
          onChange={setDate}
          open={openField === 'date'}
          onOpenChange={(open) => setOpenField(open ? 'date' : null)}
        />
        {kind === '약속' && (
          <DateTimeWheelField
            label="시간"
            mode="time"
            value={time}
            onChange={setTime}
            open={openField === 'time'}
            onOpenChange={(open) => setOpenField(open ? 'time' : null)}
          />
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
