import { useId, type CSSProperties } from 'react'
import { MAX_GOAL_MINUTES } from '../study-goal'
import { MVP_GOAL_MINUTES } from '@/features/mvp/policy'
import '../study-goal-picker.css'

export function StudyGoalPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (minutes: number) => void
}) {
  const id = useId()
  return (
    <fieldset className="mt-5 rounded-card border border-transparent bg-panel p-5">
      <legend className="sr-only">공부 목표 시간</legend>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-body-compact font-semibold">
          오늘의 목표 시간
        </label>
        <output htmlFor={id} className="font-sans tabular-nums text-section-title font-bold text-text-accent">
          {MVP_GOAL_MINUTES}
          <small className="ml-1 text-body-compact">분</small>
        </output>
      </div>
      <input
        id={id}
        type="range"
        aria-label="공부 목표 시간"
        aria-valuetext={`${value}분 선택 · 시연 목표는 ${MVP_GOAL_MINUTES}분 고정`}
        aria-describedby={`${id}-hint`}
        min={MVP_GOAL_MINUTES}
        max={MAX_GOAL_MINUTES}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="study-goal-range mt-5 w-full"
        style={{ '--goal-progress': `${(value - MVP_GOAL_MINUTES) / (MAX_GOAL_MINUTES - MVP_GOAL_MINUTES) * 100}%` } as CSSProperties}
      />
      <div className="mt-2 flex justify-between text-caption text-subtle">
        <span>3분</span>
        <span>3시간</span>
      </div>
      <p id={`${id}-hint`} className="mt-3 text-caption text-muted">
        조절값 {value}분 · 시연 목표는 3분으로 고정.
      </p>
    </fieldset>
  )
}
