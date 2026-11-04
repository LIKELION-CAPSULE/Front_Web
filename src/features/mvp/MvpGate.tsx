import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function MvpGate({ children, label, className, compact = false, inline = false }: {
  children: ReactNode
  label: string
  className?: string
  compact?: boolean
  inline?: boolean
}) {
  const Tag = inline ? 'span' : 'div'
  return (
    <Tag className={cn('mvp-gate', compact && 'mvp-gate--compact', className)} role="note" aria-label={`${label} · MVP 이후`}>
      <Tag className="mvp-gate-content" inert aria-hidden="true">{children}</Tag>
      <span className="mvp-gate-badge" aria-hidden="true">MVP 이후</span>
    </Tag>
  )
}
