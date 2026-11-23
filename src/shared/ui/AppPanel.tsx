import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/** Borderless content surface shared by app pages; no desktop window chrome. */
export function AppPanel({ title, children, className, bodyClassName, loadingScreen }: {
  title: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  loadingScreen?: string
}) {
  const titleId = useId()
  return <section className={cn('app-panel', className)} aria-labelledby={titleId} data-loading-screen={loadingScreen}>
    <h1 id={titleId} className="app-panel-heading type-page-title">{title}</h1>
    <div className={bodyClassName}>{children}</div>
  </section>
}
