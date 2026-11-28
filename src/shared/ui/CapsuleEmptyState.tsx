import type { ReactNode } from 'react'
import capsuleStill from '@/assets/capsule/capsule-upright.webp'
import { cn } from '@/shared/lib/cn'
import './capsule-empty-state.css'

/**
 * Shared empty state for non-3D screens (내 메이트 · 내 크레딧): capsule still render + one quiet line + one action.
 * No borders or outlines; surface separation comes from the host container (docs/DESIGN_SYSTEM.md).
 */
export function CapsuleEmptyState({
  message,
  action,
  size = 'md',
  className,
}: {
  message: string
  action?: ReactNode
  /** `md`: vertical stack for full empty boxes. `sm`: compact inline layout for short cards like 최근 캡슐. */
  size?: 'md' | 'sm'
  className?: string
}) {
  return (
    <div className={cn('capsule-empty-state', size === 'sm' && 'capsule-empty-state--sm', className)}>
      <img
        src={capsuleStill}
        width={320}
        height={320}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="capsule-empty-state-art"
      />
      <div className="capsule-empty-state-body">
        <p className="capsule-empty-state-message">{message}</p>
        {action && <div className="capsule-empty-state-action">{action}</div>}
      </div>
    </div>
  )
}
