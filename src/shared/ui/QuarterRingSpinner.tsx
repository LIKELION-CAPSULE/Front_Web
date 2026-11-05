import { cn } from '@/shared/lib/cn'
import './quarter-ring-spinner.css'

export function QuarterRingSpinner({ className }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" className={cn('quarter-ring-spinner', className)} viewBox="0 0 24 24" fill="none">
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
}
