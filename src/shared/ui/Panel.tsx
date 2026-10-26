import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Panel({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('ui-panel rounded-card border border-line bg-panel p-5 sm:p-6', className)}
    >
      {title && <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  dark = false,
  className,
}: {
  label: string
  value: ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'stat-card min-w-0 rounded-card border px-5 py-5',
        dark
          ? 'stat-card-featured border-brand-line bg-brand-soft text-white'
          : 'border-line bg-panel',
        className,
      )}
    >
      <p className={cn('text-sm', dark ? 'text-white/65' : 'text-muted')}>{label}</p>
      <p className="mt-3 text-[28px] leading-9 font-bold tracking-tight">{value}</p>
    </div>
  )
}
