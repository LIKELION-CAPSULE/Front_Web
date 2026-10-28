import { useMemo, useState } from 'react'
import { dayKey } from '@/shared/lib/format'
import { daysInMonth, wheelDate } from '@/shared/lib/wheel-date'
import { WheelColumn } from './WheelColumn'
import { WheelField } from './WheelField'

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
  return (
    <WheelField label={label} displayValue={formatted} icon={isDate ? 'calendar' : 'clock'} open={open} onOpenChange={onOpenChange}>
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
    </WheelField>
  )
}
