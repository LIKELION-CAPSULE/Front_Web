import { useId, useState } from 'react'

export function RelationshipProgress({ level, next, progress }: { level: number; next: number; progress: number }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const complete = level >= 5
  const percentage = complete ? 100 : Math.round(Math.min(100, Math.max(0, progress)) * 10) / 10
  const hint = complete ? '가장 가까운 친구가 되었어요.' : `Lv.${level + 1}까지 ${next}분`
  return (
    <div className="relationship-progress">
      <div className="relationship-progress-heading">
        <p className="text-[17px] font-bold">Lv.{level} 친구</p>
        <p className="relationship-progress-status">
          {complete ? '최고 레벨' : `Lv.${level + 1}까지 ${percentage}%`}
        </p>
      </div>
      <div
        className="relationship-progress-track"
        role="progressbar"
        aria-label="친구와의 관계 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={complete
          ? `Lv.${level} 친구, 최고 레벨 달성`
          : `Lv.${level} 친구, Lv.${level + 1}까지 ${percentage}% 진행, ${next}분 남음`}
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
            <span key={step} className="relationship-progress-step" data-step={step} data-state={state} aria-hidden="true">
              <span className="relationship-progress-segment">
                <span className="relationship-progress-fill" style={{ width: `${fill}%` }} />
              </span>
            </span>
          )
        })}
      </div>
      {open && (
        <div id={tooltipId} role="tooltip" className="relationship-progress-tooltip">
          <span>{hint}</span>
        </div>
      )}
    </div>
  )
}
