import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon } from './Icon'

/**
 * Shared dismiss (X) button for dialogs, settings modals, and panels.
 * Unified 44x44 circular hit target with the shared close icon and zero hover/active motion.
 */
export function CloseButton({
  label = '닫기',
  className,
  ...rest
}: {
  label?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'aria-label'>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-control-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-wait disabled:opacity-45',
        className,
      )}
      {...rest}
    >
      <Icon name="close" size={20} />
    </button>
  )
}
