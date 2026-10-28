import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function FormField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
