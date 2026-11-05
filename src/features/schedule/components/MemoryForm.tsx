import { useEffect, useRef, useState } from 'react'
import type { Memory } from '@/features/demo/types'
import { useBackend } from '@/features/backend/backend-context'
import { dayKey } from '@/shared/lib/format'
import { clampCalendarDate } from '@/shared/lib/date-limits'
import { Button } from '@/shared/ui/Button'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import { WheelSelectField } from '@/shared/ui/WheelSelectField'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'

const kindOptions = (['시험', '목표', '약속'] as const).map(value => ({ value, label: value }))

export function MemoryForm({ initialDate, inline = false, onClose, onSaved, onBusyChange }: {
  initialDate?: string
  inline?: boolean
  onClose: () => void
  onSaved?: (memory: Memory) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { createMemory } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Memory['kind']>('시험')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => clampCalendarDate(initialDate ?? dayKey()))
  const [time, setTime] = useState('20:00')
  const [openField, setOpenField] = useState<'kind' | 'date' | 'time' | null>(null)
  const pending = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!inline) return
    const frame = requestAnimationFrame(() => titleInput.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [inline])

  const titleField = <FormField label="일정 이름"><input ref={titleInput} name="memoryTitle" required maxLength={60} value={title} readOnly={busy} onChange={event => setTitle(event.target.value)} className="form-input" placeholder="예: 영어 시험" /></FormField>

  return <form aria-label="일정 추가" className={inline ? 'schedule-editor [--form-input-border:var(--color-input-border)]' : 'space-y-4 [--form-input-border:var(--color-input-border)]'} onKeyDown={event => {
    if (!inline || event.key !== 'Escape') return
    event.preventDefault(); event.stopPropagation()
    if (!pending.current) onClose()
  }} onSubmit={async event => {
    event.preventDefault()
    if (pending.current || !title.trim()) return
    pending.current = true
    setOpenField(null)
    setBusy(true); onBusyChange?.(true); setError('')
    try {
      const saved = await createMemory({ kind, title: title.trim(), date, time: kind === '약속' ? time : '' })
      onSaved?.(saved)
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '일정을 저장하지 못했어요.') }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false) }
  }}>
    <div className={inline ? 'schedule-list-scroll' : undefined}>
      <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
        {inline && titleField}
        <WheelSelectField label="종류" options={kindOptions} value={kind} onChange={setKind} open={openField === 'kind'} onOpenChange={open => setOpenField(open ? 'kind' : null)} />
        {!inline && titleField}
        <DateTimeWheelField label="날짜" mode="date" value={date} onChange={setDate} open={openField === 'date'} onOpenChange={open => setOpenField(open ? 'date' : null)} />
        {kind === '약속' && <DateTimeWheelField label="시간" mode="time" value={time} onChange={setTime} open={openField === 'time'} onOpenChange={open => setOpenField(open ? 'time' : null)} />}
        {!inline && error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
      </fieldset>
    </div>
    <div className={inline ? 'schedule-list-toolbar schedule-editor-actions' : 'flex gap-3'}>
      {inline && error && <FeedbackMessage tone="error" className="w-full">{error}</FeedbackMessage>}
      {inline && <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>취소</Button>}
      <Button type="submit" size={inline ? 'sm' : 'lg'} className={inline ? undefined : 'flex-1'} loading={busy} disabled={!title.trim()}>저장하기</Button>
    </div>
  </form>
}
