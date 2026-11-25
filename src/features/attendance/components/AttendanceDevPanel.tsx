import { CYCLE_DAYS } from '../attendance-config'
import '../attendance-dev.css'

/** Development only: jump to any day and replay a check-in. Render it behind `import.meta.env.DEV`. */
export function AttendanceDevPanel({ disabled, cycleDay, checkedToday, onSet, className }: {
  disabled: boolean
  cycleDay: number
  checkedToday: boolean
  onSet: (cycleDay: number, checkedToday: boolean) => Promise<void>
  className?: string
}) {
  return (
    <details className={className ? `att-dev ${className}` : 'att-dev'}>
      <summary>DEV</summary>
      <p>완료 {cycleDay}일 · 오늘 {checkedToday ? '출석함' : '미출석'}</p>
      <div>
        {Array.from({ length: CYCLE_DAYS + 1 }, (_, day) => (
          <button key={day} type="button" disabled={disabled} aria-pressed={day === cycleDay} onClick={() => void onSet(day, false)}>{day}</button>
        ))}
      </div>
      <div>
        <button type="button" disabled={disabled} onClick={() => void onSet(1, false)}>1→2</button>
        <button type="button" disabled={disabled} onClick={() => void onSet(3, false)}>3→4</button>
        <button type="button" disabled={disabled} onClick={() => void onSet(CYCLE_DAYS - 1, false)}>{CYCLE_DAYS - 1}→{CYCLE_DAYS}</button>
        <button type="button" disabled={disabled} onClick={() => void onSet(cycleDay, !checkedToday)}>오늘 출석 토글</button>
      </div>
    </details>
  )
}
