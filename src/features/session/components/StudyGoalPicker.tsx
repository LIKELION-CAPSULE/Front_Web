import { useId, type CSSProperties, type ReactNode } from 'react'
import { MAX_GOAL_MINUTES, MIN_GOAL_MINUTES } from '../study-goal'
import { cn } from '@/shared/lib/cn'
import '../study-goal-picker.css'

export function StudyGoalPicker({
  value,
  onChange,
  className,
  headerAction,
  descriptionId,
  disabled = false,
}: {
  value: number
  onChange: (minutes: number) => void
  className?: string
  headerAction?: ReactNode
  descriptionId?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <fieldset disabled={disabled} className={cn('mt-5 rounded-card border border-transparent bg-panel p-5', className)}>
      <legend className="sr-only">공부 목표 시간</legend>
      <div className={headerAction ? 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'flex justify-center'}>
        <div className={cn('flex min-w-0 flex-col items-center gap-2 text-center', !!headerAction && 'sm:col-start-2')}>
          <label htmlFor={id} className="break-keep text-body-compact font-semibold">
            오늘의 목표 시간
          </label>
          <output htmlFor={id} className="font-sans tabular-nums whitespace-nowrap text-stat font-bold text-text-accent">
            {value}
            <small className="ml-1 text-body">분</small>
          </output>
        </div>
        {headerAction && <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3">{headerAction}</div>}
      </div>
      <input
        id={id}
        type="range"
        aria-label="공부 목표 시간"
        aria-valuetext={`${value}분`}
        aria-describedby={descriptionId}
        min={MIN_GOAL_MINUTES}
        max={MAX_GOAL_MINUTES}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="study-goal-range mt-5 w-full"
        style={{ '--goal-progress': `${(value - MIN_GOAL_MINUTES) / (MAX_GOAL_MINUTES - MIN_GOAL_MINUTES) * 100}%` } as CSSProperties}
      />
    </fieldset>
  )
}
