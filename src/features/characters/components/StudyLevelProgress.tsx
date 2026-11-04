import { useId, useState } from 'react'
import { FloatingSurface } from '@/shared/ui/FloatingSurface'

export function StudyLevelProgress({ level, next, progress }: { level: number; next: number; progress: number }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const complete = level >= 5
  const percentage = complete ? 100 : Math.round(Math.min(100, Math.max(0, progress)) * 10) / 10
  const hint = complete ? '최고 레벨을 달성했어요.' : `Lv.${level + 1}까지 ${next}분`
  return (
    <div className="study-level-progress">
      <div className="study-level-progress-heading">
        <p className="text-card-title font-bold">공부 레벨 Lv.{level}</p>
        <p className="study-level-progress-status">
          {complete ? '최고 레벨' : `Lv.${level + 1}까지 ${percentage}%`}
        </p>
      </div>
      <div
        className="study-level-progress-track"
        role="progressbar"
        aria-label="공부 레벨 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={complete
          ? `공부 레벨 Lv.${level}, 최고 레벨 달성`
          : `공부 레벨 Lv.${level}, Lv.${level + 1}까지 ${percentage}% 진행, ${next}분 남음`}
        aria-describedby={open ? tooltipId : undefined}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        {[1, 2, 3, 4, 5].map((step) => {
          const fill = step <= level ? 100 : step === level + 1 ? percentage : 0
          const state = step < level ? 'complete' : step === level ? 'current' : step === level + 1 ? 'next' : 'locked'
          return (
            <span key={step} className="study-level-progress-step" data-step={step} data-state={state} aria-hidden="true">
              <span className="study-level-progress-segment">
                <span className="study-level-progress-fill" style={{ width: `${fill}%` }} />
              </span>
            </span>
          )
        })}
      </div>
      {open && (
        <div id={tooltipId} role="tooltip" className="study-level-progress-tooltip">
          <FloatingSurface>{hint}</FloatingSurface>
        </div>
      )}
    </div>
  )
}
