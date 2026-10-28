import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'

export function OverlayPage({
  children,
  className,
  backTo,
  headerAside,
  headerClassName,
}: {
  children: ReactNode
  className?: string
  backTo?: string
  headerAside?: ReactNode
  headerClassName?: string
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="overlay-page min-h-dvh px-4 py-16 focus:outline-none"
    >
      <PageNavigation />
      <div
        className={cn(
          'overlay-content w-full max-w-[720px] rounded-3xl bg-panel p-6 shadow-2xl sm:p-10',
          className,
        )}
      >
        {(backTo || headerAside) && (
          <div className={cn('mb-5 flex items-start justify-between gap-4', headerClassName)}>
            {backTo && (
              <Link
                to={backTo}
                className="inline-flex min-h-8 shrink-0 items-center text-sm text-muted hover:text-ink"
              >
                ← 돌아가기
              </Link>
            )}
            {headerAside && <div className="ml-auto min-w-0">{headerAside}</div>}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
