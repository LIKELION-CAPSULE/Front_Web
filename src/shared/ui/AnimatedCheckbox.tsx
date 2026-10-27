import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/cn'
import './control-motion.css'

/** Native input keeps form validation, reset, keyboard and FormData behavior intact. */
export function AnimatedCheckbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <span className={cn('animated-checkbox', className)}>
      <input {...props} type="checkbox" className="animated-checkbox-input" />
      <span className="animated-checkbox-face" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="m5 12 4 4L19 6" pathLength={1} />
        </svg>
      </span>
    </span>
  )
}
