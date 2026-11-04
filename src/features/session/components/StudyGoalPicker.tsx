import { useId, type CSSProperties } from 'react'
import { MAX_GOAL_MINUTES, MIN_GOAL_MINUTES, normalizeGoalMinutes } from '../study-goal'
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
          {value}
          <small className="ml-1 text-body-compact">분</small>
        </output>
      </div>
      <input
        id={id}
        type="range"
        aria-label="공부 목표 시간"
        aria-valuetext={`${value}분`}
        min={MIN_GOAL_MINUTES}
        max={MAX_GOAL_MINUTES}
        step={5}
        value={value}
        onChange={(event) => onChange(normalizeGoalMinutes(Number(event.target.value)))}
        className="study-goal-range mt-5 w-full"
        style={{ '--goal-progress': `${(normalizeGoalMinutes(value) - MIN_GOAL_MINUTES) / (MAX_GOAL_MINUTES - MIN_GOAL_MINUTES) * 100}%` } as CSSProperties}
      />
      <div className="mt-2 flex justify-between text-caption text-subtle">
        <span>5분</span>
        <span>3시간</span>
      </div>
    </fieldset>
  )
}
