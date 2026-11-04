import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from './Icon'

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info'

const tones: Record<FeedbackTone, { color: string; icon: IconName }> = {
  success: { color: 'text-success', icon: 'check' },
  warning: { color: 'text-warning', icon: 'warning' },
  error: { color: 'text-danger', icon: 'close' },
  info: { color: 'text-info', icon: 'info' },
}

export function FeedbackMessage({ tone, children, className, align = 'start', compact = false, id }: {
  tone: FeedbackTone
  children: ReactNode
  className?: string
  align?: 'start' | 'center'
  compact?: boolean
  id?: string
}) {
  const { color, icon } = tones[tone]
  return (
    <p
      id={id}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      data-feedback={tone}
      className={cn(
        'flex items-start gap-2',
        compact ? 'type-caption' : 'type-body-compact',
        color,
        align === 'center' && 'justify-center text-center',
        className,
      )}
    >
      <Icon name={icon} size={16} className={cn('shrink-0', compact ? 'mt-px' : 'mt-[3px]')} />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
