import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import {
  formatBirthDateValue,
  normalizeDayInput,
  normalizeMonthInput,
  parseBirthDateParts,
  type BirthDateParts,
} from '../birth-date'

function splitInitial(value?: string): BirthDateParts {
  if (!value) return { year: '', month: '', day: '' }
  const parsed = parseBirthDateParts(value)
  if (parsed) return parsed
  const [y = '', m = '', d = ''] = value.split('-')
  return {
    year: y.replace(/\D/g, '').slice(0, 4),
    month: m.replace(/\D/g, '').slice(0, 2),
    day: d.replace(/\D/g, '').slice(0, 2),
  }
}

export function BirthDateField({
  value,
  onChange,
  readOnly,
  error,
  errorId,
}: {
  value?: string
  onChange: (value: string) => void
  readOnly?: boolean
  error?: string
  errorId: string
}) {
  const helpId = useId()
  const [parts, setParts] = useState<BirthDateParts>(() => splitInitial(value))
  const [syncedValue, setSyncedValue] = useState<string | undefined>(value)
  const yearRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)

  // Keep internal parts in sync if a controlled parent resets/updates value externally
  if (value !== undefined && value !== syncedValue) {
    setSyncedValue(value)
    const currentFormatted = formatBirthDateValue(parts.year, parts.month, parts.day)
    if (value !== currentFormatted) {
      setParts(splitInitial(value))
    }
  }

  const combined = formatBirthDateValue(parts.year, parts.month, parts.day)
  const describedBy = error ? `${errorId} ${helpId}` : helpId

  function commit(next: BirthDateParts) {
    setParts(next)
    const formatted = formatBirthDateValue(next.year, next.month, next.day)
    setSyncedValue(formatted)
    onChange(formatted)
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (readOnly) return
    const text = event.clipboardData.getData('text')
    const parsed = parseBirthDateParts(text)
    if (parsed && parsed.year && parsed.month && parsed.day) {
      event.preventDefault()
      commit(parsed)
      dayRef.current?.focus()
    }
  }

  function handleKeyDown(field: 'month' | 'day', event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' || readOnly) return
    if (field === 'month' && parts.month.length === 0) {
      event.preventDefault()
      yearRef.current?.focus()
    } else if (field === 'day' && parts.day.length === 0) {
      event.preventDefault()
      monthRef.current?.focus()
    }
  }

  function padTwoOnBlur(field: 'month' | 'day') {
    const raw = parts[field]
    if (raw.length === 1 && raw !== '0') {
      commit({ ...parts, [field]: raw.padStart(2, '0') })
    }
  }

  return (
    <fieldset
      className="mx-0 min-w-0 border-0 p-0"
      aria-invalid={!!error || undefined}
      aria-describedby={describedBy}
    >
      <legend className="field-label">생년월일</legend>
      <input type="hidden" name="birthDate" value={combined} />
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <input
          ref={yearRef}
          name="birthYear"
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          placeholder="연도"
          aria-label="연도"
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          readOnly={readOnly}
          value={parts.year}
          className="form-input text-center tabular-nums"
          onPaste={handlePaste}
          onChange={(event) => {
            const year = event.target.value.replace(/\D/g, '').slice(0, 4)
            commit({ ...parts, year })
            if (year.length === 4) {
              monthRef.current?.focus()
            }
          }}
        />
        <input
          ref={monthRef}
          name="birthMonth"
          type="text"
          inputMode="numeric"
          autoComplete="bday-month"
          maxLength={2}
          placeholder="월"
          aria-label="월"
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          readOnly={readOnly}
          value={parts.month}
          className="form-input text-center tabular-nums"
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown('month', event)}
          onBlur={() => padTwoOnBlur('month')}
          onChange={(event) => {
            const { value: month, advance } = normalizeMonthInput(event.target.value, parts.month)
            commit({ ...parts, month })
            if (advance) {
              dayRef.current?.focus()
            }
          }}
        />
        <input
          ref={dayRef}
          name="birthDay"
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          maxLength={2}
          placeholder="일"
          aria-label="일"
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          readOnly={readOnly}
          value={parts.day}
          className="form-input text-center tabular-nums"
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown('day', event)}
          onBlur={() => padTwoOnBlur('day')}
          onChange={(event) => {
            const { value: day } = normalizeDayInput(event.target.value, parts.day)
            commit({ ...parts, day })
          }}
        />
      </div>
      <p id={helpId} className="mt-1.5 text-caption text-muted">
        예: 2002년 1월 3일 → 2002 / 1 / 3
      </p>
      {error && (
        <FeedbackMessage id={errorId} tone="error" className="mt-1.5">
          {error}
        </FeedbackMessage>
      )}
    </fieldset>
  )
}
