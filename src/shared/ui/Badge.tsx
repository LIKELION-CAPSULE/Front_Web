import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Badge({
  children,
  dark = false,
  className,
}: {
  children: ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'badge inline-flex items-center rounded-full px-2.5 py-1 text-xs leading-4',
        dark ? 'bg-brand-solid text-white' : 'bg-surface text-brand-strong',
        className,
      )}
    >
      {children}
    </span>
  )
}
