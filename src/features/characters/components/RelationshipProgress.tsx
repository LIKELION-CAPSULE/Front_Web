import { useId, useState } from 'react'
import { cn } from '@/shared/lib/cn'

export function RelationshipProgress({ level, next }: { level: number; next: number }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const hint = level >= 5 ? '가장 가까운 친구가 되었어요.' : `Lv.${level + 1}까지 ${next}분`
  return (
    <div
      className="relationship-progress"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="relationship-progress-track"
        role="progressbar"
        aria-label="친구와의 관계 단계"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={level}
        aria-valuetext={`Lv.${level} 친구`}
        aria-describedby={open ? tooltipId : undefined}
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className={cn('h-3 flex-1 rounded-full', level >= step ? 'bg-brand-solid' : 'bg-line')}
          />
        ))}
      </div>
      {open && (
        <div id={tooltipId} role="tooltip" className="relationship-progress-tooltip">
          <span>{hint}</span>
        </div>
      )}
    </div>
  )
}
