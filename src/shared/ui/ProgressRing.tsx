import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
export function ProgressRing({
  value,
  label,
  size = 64,
  children,
  className,
}: {
  value: number
  label: string
  size?: number
  children?: ReactNode
  className?: string
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))
  const length = 2 * Math.PI * 26
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      className={cn('progress-ring', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" className="progress-ring-track" />
        <circle
          cx="32"
          cy="32"
          r="26"
          className="progress-ring-value"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - percent / 100)}
        />
      </svg>
      <span aria-hidden="true">
        {children ?? (
          <strong>
            {percent}
            <small>%</small>
          </strong>
        )}
      </span>
    </span>
  )
}
