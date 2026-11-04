import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-solid'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  soft: 'button-soft',
  ghost: 'button-ghost',
  danger: 'button-danger',
  'danger-solid': 'button-danger-solid',
}

const sizes: Record<Size, string> = {
  xs: 'min-h-8 min-w-8 rounded-control px-3 py-1.5 type-button-micro max-md:min-h-11 max-md:min-w-11',
  sm: 'min-h-10 min-w-10 rounded-control px-4 py-2 type-button-compact max-md:min-h-11 max-md:min-w-11',
  md: 'min-h-11 min-w-11 rounded-control px-5 py-2.5 type-button',
  lg: 'min-h-12 min-w-12 rounded-control px-6 py-3 type-button',
}

function controlClasses(variant: Variant, size: Size, className?: string) {
  return cn(
    'ui-button inline-flex items-center justify-center gap-2 text-center break-keep transition-colors disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  )
}

type ControlProps = { variant?: Variant; size?: Size; loading?: boolean }
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ControlProps

export function Button({ variant = 'primary', size = 'lg', loading = false, disabled, children, className, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading || undefined} className={controlClasses(variant, size, className)}>{children}</button>
}

type ButtonLinkProps = Omit<LinkProps, 'children'> & ControlProps & { children: ReactNode }

export function ButtonLink({ variant = 'primary', size = 'lg', loading = false, onClick, className, ...props }: ButtonLinkProps) {
  return <Link {...props} aria-busy={loading || undefined} aria-disabled={loading || undefined} data-loading={loading || undefined} onClick={event => { if (loading) event.preventDefault(); else onClick?.(event) }} className={controlClasses(variant, size, className)} />
}
