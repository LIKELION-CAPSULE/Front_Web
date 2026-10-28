import { useId } from 'react'
import { MAX_GOAL_MINUTES, MIN_GOAL_MINUTES, normalizeGoalMinutes } from '../study-goal'

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
        <label htmlFor={id} className="text-sm font-semibold">
          오늘의 목표 시간
        </label>
        <output htmlFor={id} className="font-mono text-2xl font-bold text-brand-strong">
          {value}
          <small className="ml-1 text-sm">분</small>
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
        className="mt-5 min-h-11 w-full cursor-pointer accent-brand-solid"
      />
      <div className="mt-2 flex justify-between text-[11px] text-subtle">
        <span>5분</span>
        <span>3시간</span>
      </div>
      <div className="mt-4 flex gap-2" role="group" aria-label="목표 시간 빠르게 선택">
        {[25, 50, 90].map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={value === minutes}
            onClick={() => onChange(minutes)}
            className={`min-h-11 flex-1 rounded-control border px-3 py-2 text-sm ${value === minutes ? 'border-brand-line bg-brand-soft text-brand-strong' : 'button-subtle border-transparent text-muted'}`}
          >
            {minutes}분
          </button>
        ))}
      </div>
    </fieldset>
  )
}
