import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * One placeholder bar or block (the shared `.skeleton-line` sweep). `raised`: it sits on a card that already has the
 * panel colour (a block, the onboarding panel), so it takes the lighter surface colour to stay visible.
 */
export function SkeletonLine({ className, style, raised = false }: { className?: string; style?: CSSProperties; raised?: boolean }) {
  return <span aria-hidden="true" className={cn('skeleton-line block rounded-control', raised && 'skeleton-line--raised', className)} style={style} />
}
