import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/cn'
import './control-motion.css'
import { Icon } from './Icon'

/** Native input keeps form validation, reset, keyboard and FormData behavior intact. */
export function AnimatedCheckbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <span className={cn('animated-checkbox', className)}>
      <input {...props} type="checkbox" className="animated-checkbox-input" />
      <span className="animated-checkbox-face" aria-hidden="true">
        <Icon name="check" size={16} />
      </span>
    </span>
  )
}
