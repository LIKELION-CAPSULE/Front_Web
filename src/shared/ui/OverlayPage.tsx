import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'

export function OverlayPage({
  children,
  className,
  backTo,
}: {
  children: ReactNode
  className?: string
  backTo?: string
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="overlay-page min-h-dvh px-4 py-16 focus:outline-none"
    >
      <PageNavigation />
      {backTo && (
        <Link to={backTo} className="absolute top-5 left-5 text-sm text-white/80 hover:text-white">
          ← 돌아가기
        </Link>
      )}
      <div
        className={cn(
          'overlay-content w-full max-w-[720px] rounded-3xl border border-line bg-panel p-6 shadow-2xl sm:p-10',
          className,
        )}
      >
        {children}
      </div>
    </main>
  )
}
