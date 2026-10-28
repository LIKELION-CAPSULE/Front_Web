import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Panel({
  title,
  children,
  className,
  density = 'normal',
  bordered = false,
  ...props
}: Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
  title?: string
  density?: 'compact' | 'normal' | 'roomy'
  bordered?: boolean
}) {
  return (
    <section
      {...props}
      className={cn(
        'ui-panel rounded-card bg-panel',
        bordered && 'border border-line',
        density === 'compact' ? 'p-panel-compact' : density === 'roomy' ? 'p-panel sm:p-panel-roomy' : 'p-panel-compact sm:p-panel',
        className,
      )}
    >
      {title && <h2 className="mb-4 text-card-title font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  dark = false,
  className,
  size = 'normal',
}: {
  label: string
  value: ReactNode
  dark?: boolean
  className?: string
  size?: 'normal' | 'compact'
}) {
  return (
    <div
      className={cn(
        'stat-card min-w-0 rounded-card border border-transparent p-panel-compact',
        size === 'compact' && 'px-3 sm:px-5',
        dark
          ? 'stat-card-featured bg-brand-soft text-white'
          : 'bg-panel',
        className,
      )}
    >
      <p className={cn('text-sm', dark ? 'text-white/65' : 'text-muted')}>{label}</p>
      <p className={cn('mt-3 font-bold tracking-tight', size === 'compact' ? 'text-[22px] leading-8 sm:text-2xl' : 'text-[28px] leading-9')}>{value}</p>
    </div>
  )
}
