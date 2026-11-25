import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/** Borderless content surface shared by app pages; no desktop window chrome. */
export function AppPanel({ title, children, className, bodyClassName, loadingScreen, hideTitle = false }: {
  title: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  loadingScreen?: string
  /**
   * The header navigation already names the page: the h1 stays for screen readers and the page structure, but is
   * not shown (and takes no room).
   */
  hideTitle?: boolean
}) {
  const titleId = useId()
  return <section className={cn('app-panel', className)} aria-labelledby={titleId} data-loading-screen={loadingScreen} data-title-hidden={hideTitle || undefined}>
    <h1 id={titleId} className={hideTitle ? 'sr-only' : 'app-panel-heading type-page-title'}>{title}</h1>
    <div className={bodyClassName}>{children}</div>
  </section>
}
