import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/shared/lib/cn'
import './floating-surface.css'

export function FloatingSurface({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('floating-surface', className)} />
}
