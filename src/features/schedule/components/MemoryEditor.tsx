import { useState } from 'react'
import type { Memory } from '@/features/demo/types'
import { dayKey } from '@/shared/lib/format'
import { clampCalendarDate } from '@/shared/lib/date-limits'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import { WheelSelectField } from '@/shared/ui/WheelSelectField'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { useBackend } from '@/features/backend/backend-context'

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
  const { createMemory } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Memory['kind']>(initial?.kind ?? '시험')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(() => clampCalendarDate(initial?.date ?? initialDate ?? dayKey()))
  const [time, setTime] = useState(initial?.time || '20:00')
  const [openField, setOpenField] = useState<'kind' | 'date' | 'time' | null>(null)
  if (initial) return <Dialog open onClose={onClose} title="일정 상세">
    <dl className="space-y-3 text-body-compact"><div><dt className="text-muted">종류</dt><dd>{initial.kind}</dd></div><div><dt className="text-muted">일정 이름</dt><dd>{initial.title}</dd></div><div><dt className="text-muted">날짜</dt><dd>{initial.date || '마감일 없음'}</dd></div><div><dt className="text-muted">시간</dt><dd>{initial.time || '종일'}</dd></div></dl>
    <p className="mt-5 text-caption text-muted">저장한 일정의 수정·삭제는 아직 제공하지 않아요.</p>
  </Dialog>
  return (
    <Dialog open onClose={onClose} title={initial ? '일정 수정' : '일정 추가'}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy || initial) return
          const memory = {
            kind,
            title: title.trim(),
            date,
            time: kind === '약속' ? time : '',
          }
          setBusy(true)
          setError('')
          try {
            const saved = await createMemory(memory)
            onSaved?.(saved)
            onClose()
          } catch (reason) { setError(reason instanceof Error ? reason.message : '일정을 저장하지 못했어요.') }
          finally { setBusy(false) }
        }}
        className="space-y-4 [--form-input-border:var(--color-input-border)]"
      >
        <WheelSelectField
          label="종류"
          options={kindOptions}
          value={kind}
          onChange={setKind}
          open={openField === 'kind'}
          onOpenChange={(open) => setOpenField(open ? 'kind' : null)}
        />
        <FormField label="일정 이름">
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
        {initial && <FeedbackMessage tone="info">저장한 일정의 수정·삭제는 아직 제공하지 않아요.</FeedbackMessage>}
        {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !!initial || !title.trim()} className="flex-1">
            {busy ? '저장하고 있어요…' : '저장하기'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
