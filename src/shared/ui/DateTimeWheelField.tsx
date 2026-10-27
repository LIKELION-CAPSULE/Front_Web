import { useId, useMemo, useRef, useState } from 'react'
import { dayKey } from '@/shared/lib/format'
import { daysInMonth, wheelDate } from '@/shared/lib/wheel-date'
import { Icon } from './Icon'
import { WheelColumn } from './WheelColumn'
import './wheel-picker.css'

const padded = (value: number) => String(value).padStart(2, '0')
const numbers = (from: number, to: number, suffix: string) => Array.from(
  { length: Math.max(0, to - from + 1) },
  (_, index) => ({ value: String(from + index), label: `${from + index}${suffix}` }),
)

export function DateTimeWheelField({
  label,
  mode,
  value,
  min,
  open,
  onOpenChange,
  onChange,
}: {
  label: string
  mode: 'date' | 'time'
  value: string
  min?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: string) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [currentYear] = useState(() => Number(dayKey().slice(0, 4)))
  const isDate = mode === 'date'
  const [year = currentYear, month = 1, day = 1] = value.split('-').map(Number)
  const [hour = 0, minute = 0] = value.split(':').map(Number)
  const minimumYear = min ? Number(min.slice(0, 4)) : Math.min(currentYear - 10, Number(value.slice(0, 4)))
  const maximumYear = Math.max(currentYear + 10, Number(value.slice(0, 4)))
  const years = useMemo(() => isDate ? numbers(minimumYear, maximumYear, '년') : [], [isDate, minimumYear, maximumYear])
  const minimumMonth = min && year === Number(min.slice(0, 4)) ? Number(min.slice(5, 7)) : 1
  const minimumDay = min && value.slice(0, 7) === min.slice(0, 7) ? Number(min.slice(8)) : 1
  const formatted = isDate ? value.replaceAll('-', '.') : value
  function close() {
    onOpenChange(false)
    trigger.current?.focus({ preventScroll: true })
  }
  return (
    <div
      className="wheel-field"
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        close()
      }}
    >
      <span id={`${id}-label`} className="wheel-field-label">{label}</span>
      <button
        ref={trigger}
        type="button"
        className="wheel-field-trigger form-input"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={open ? `${id}-picker` : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span id={`${id}-value`}>{formatted}</span>
        <Icon name={isDate ? 'calendar' : 'clock'} size={16} motion="draw" className="text-subtle" />
      </button>
      {open && (
        <div
          id={`${id}-picker`}
          className="wheel-picker"
          role="group"
          aria-label={label.endsWith('선택') ? label : `${label} 선택`}
        >
          <div className="wheel-picker-columns">
            {isDate ? (
              <>
                <WheelColumn label="연도" options={years} value={String(year)} onChange={(next) => onChange(wheelDate(Number(next), month, day, min))} />
                <WheelColumn label="월" options={numbers(minimumMonth, 12, '월')} value={String(month)} onChange={(next) => onChange(wheelDate(year, Number(next), day, min))} />
                <WheelColumn label="일" options={numbers(minimumDay, daysInMonth(year, month), '일')} value={String(day)} onChange={(next) => onChange(wheelDate(year, month, Number(next), min))} />
              </>
            ) : (
              <>
                <WheelColumn label="시" options={numbers(0, 23, '시')} value={String(hour)} onChange={(next) => onChange(`${padded(Number(next))}:${padded(minute)}`)} />
                <WheelColumn label="분" options={numbers(0, 59, '분')} value={String(minute)} onChange={(next) => onChange(`${padded(hour)}:${padded(Number(next))}`)} />
              </>
            )}
          </div>
          <div className="wheel-picker-footer">
            <button type="button" className="wheel-picker-done" onClick={close}>완료</button>
          </div>
        </div>
      )}
    </div>
  )
}
