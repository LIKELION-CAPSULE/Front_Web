import { Children, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import '../study-grid.css'

/** The focused tile comes first; keep every tile in the same parent to preserve live video. */
export function StudyGrid({ focused, children }: { focused: boolean; children: ReactNode }) {
  const participants = Children.count(children)
  return (
    <div
      className={cn('study-grid', focused && 'is-focus', participants === 2 && 'is-one-to-one')}
      data-participants={participants}
      style={{ '--study-thumbnail-count': Math.max(1, participants - 1) } as CSSProperties}
    >
      {children}
    </div>
  )
}
