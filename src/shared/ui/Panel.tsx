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
        bordered && 'border border-divider',
        density === 'compact' ? 'p-panel-compact' : density === 'roomy' ? 'p-panel sm:p-panel-roomy' : 'p-panel-compact sm:p-panel',
        className,
      )}
    >
      {title && <h2 className="mb-4 text-ink type-card-title">{title}</h2>}
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
  layout = 'stack',
}: {
  label: string
  value: ReactNode
  dark?: boolean
  className?: string
  size?: 'normal' | 'compact'
  layout?: 'stack' | 'responsive-row'
}) {
  return (
    <div
      className={cn(
        'stat-card min-w-0 rounded-card border border-transparent p-panel-compact',
        size === 'compact' && 'px-3 sm:px-5',
        layout === 'responsive-row' && 'max-[480px]:flex max-[480px]:items-center max-[480px]:justify-between max-[480px]:gap-4 max-[480px]:px-4 max-[480px]:py-3',
        dark
          ? 'stat-card-featured bg-primary-soft text-ink'
          : 'bg-panel',
        className,
      )}
    >
      <p className="type-label text-muted">{label}</p>
      <p className={cn('mt-3 type-stat', layout === 'responsive-row' && 'max-[480px]:mt-0 max-[480px]:text-right')}>{value}</p>
    </div>
  )
}
