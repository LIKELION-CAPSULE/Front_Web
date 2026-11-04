import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { FeedbackMessage } from './FeedbackMessage'

export function FormField({ label, children, className, error, errorId }: { label: string; children: ReactNode; className?: string; error?: string; errorId?: string }) {
  const generatedId = useId()
  return (
    <div className={cn('block', className)}>
      <label className="block">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {error && <FeedbackMessage id={errorId ?? generatedId} tone="error" className="mt-2">{error}</FeedbackMessage>}
    </div>
  )
}
