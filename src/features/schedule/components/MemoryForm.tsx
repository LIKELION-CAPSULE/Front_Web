import { useEffect, useId, useRef, useState } from 'react'
import type { Memory } from '@/features/demo/types'
import { useBackend } from '@/features/backend/backend-context'
import { dayKey } from '@/shared/lib/format'
import { clampCalendarDate, MIN_CALENDAR_DATE } from '@/shared/lib/date-limits'
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
  /** The inline form leaves the time empty (all day) until a time is picked; a promise starts at 20:00. */
  const [time, setTime] = useState(inline ? '' : '20:00')
  const [openField, setOpenField] = useState<'kind' | 'date' | 'time' | null>(null)
  const pending = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const kindId = useId()
  const canSave = !!title.trim() && (!inline || (!!date && (kind !== '약속' || !!time)))

  useEffect(() => {
    if (!inline) return
    const frame = requestAnimationFrame(() => titleInput.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [inline])

  const titleField = <FormField label="일정 이름" className={inline ? 'schedule-editor-field' : undefined}><input ref={titleInput} name="memoryTitle" required maxLength={60} value={title} readOnly={busy} onChange={event => setTitle(event.target.value)} className="form-input" placeholder="예: 영어 시험" /></FormField>

  return <form aria-label="일정 추가" className={inline ? 'schedule-editor [--form-input-border:var(--color-input-border)]' : 'space-y-4 [--form-input-border:var(--color-input-border)]'} onKeyDown={event => {
    if (!inline || event.key !== 'Escape') return
    event.preventDefault(); event.stopPropagation()
    if (!pending.current) onClose()
  }} onSubmit={async event => {
    event.preventDefault()
    if (pending.current || !canSave || !event.currentTarget.checkValidity()) return
    pending.current = true
    setOpenField(null)
    setBusy(true); onBusyChange?.(true); setError('')
    try {
      const saved = await createMemory({ kind, title: title.trim(), date, time: kind === '약속' || inline ? time : '' })
      onSaved?.(saved)
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '일정을 저장하지 못했어요.') }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false) }
  }}>
    <div className={inline ? 'schedule-list-scroll' : undefined}>
      <fieldset disabled={busy} className={inline ? 'schedule-editor-fields min-w-0 border-0 p-0' : 'min-w-0 space-y-4 border-0 p-0'}>
        {inline ? <>
          {titleField}
          <div className="schedule-editor-kind">
            <span id={kindId} className="field-label">종류</span>
            <div className="schedule-kind-options" role="radiogroup" aria-labelledby={kindId}>
              {kindOptions.map(option => <label key={option.value} className="schedule-kind-option"><input className="sr-only" type="radio" name={`${kindId}-kind`} value={option.value} checked={kind === option.value} onChange={() => { setKind(option.value); if (option.value === '약속' && !time) setTime('20:00') }} /><span>{option.label}</span></label>)}
            </div>
          </div>
          <FormField label="날짜" className="schedule-editor-field"><input className="form-input" name="memoryDate" type="date" min={MIN_CALENDAR_DATE} max="9999-12-31" required value={date} readOnly={busy} onChange={event => setDate(event.target.value)} /></FormField>
          <FormField label={kind === '약속' ? '시간' : '시간 (선택)'} className="schedule-editor-field"><input className="form-input" name="memoryTime" type="time" value={time} required={kind === '약속'} readOnly={busy} onChange={event => setTime(event.target.value)} /></FormField>
        </> : <>
          <WheelSelectField label="종류" options={kindOptions} value={kind} onChange={setKind} open={openField === 'kind'} onOpenChange={open => setOpenField(open ? 'kind' : null)} />
          {titleField}
          <DateTimeWheelField label="날짜" mode="date" value={date} onChange={setDate} open={openField === 'date'} onOpenChange={open => setOpenField(open ? 'date' : null)} />
          {kind === '약속' && <DateTimeWheelField label="시간" mode="time" value={time} onChange={setTime} open={openField === 'time'} onOpenChange={open => setOpenField(open ? 'time' : null)} />}
          {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
        </>}
      </fieldset>
    </div>
    <div className={inline ? 'schedule-list-toolbar schedule-editor-actions' : 'flex gap-3'}>
      {inline && error && <FeedbackMessage tone="error" className="w-full">{error}</FeedbackMessage>}
      {inline && <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>취소</Button>}
      <Button type="submit" size={inline ? 'sm' : 'lg'} className={inline ? undefined : 'flex-1'} loading={busy} disabled={!canSave}>저장하기</Button>
    </div>
  </form>
}
