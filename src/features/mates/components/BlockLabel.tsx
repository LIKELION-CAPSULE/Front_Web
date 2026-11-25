import type { ReactNode } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { IconName } from '@/shared/ui/animate-icons/icons'
import './block-label.css'

/**
 * Header of a 내 메이트 block: one style everywhere, a small icon and the title, an optional count right beside the
 * title (a muted figure; read as `countLabel`), and an optional note at the far right (an action).
 */
export function BlockLabel({ id, icon, children, count, countLabel, note }: {
  id: string
  icon: IconName
  children: ReactNode
  count?: number
  countLabel?: string
  note?: ReactNode
}) {
  return (
    <p className="mate-game-label">
      <span className="mate-game-label-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span id={id}>{children}</span>
      {count !== undefined && (
        <span className="mate-game-label-count">
          <span aria-hidden="true">{count.toLocaleString('ko-KR')}</span>
          <span className="sr-only">{countLabel ?? `${count}개`}</span>
        </span>
      )}
      {note && <span className="mate-game-label-note">{note}</span>}
    </p>
  )
}
