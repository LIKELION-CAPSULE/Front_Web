import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'button-primary text-white',
  secondary: 'button-secondary text-ink',
  soft: 'button-soft text-ink',
  ghost: 'button-ghost text-muted',
}

const sizes: Record<Size, string> = {
  xs: 'min-h-8 rounded-lg px-3 py-1.5 text-xs leading-4',
  sm: 'min-h-10 rounded-control px-4 py-2 text-[13px] leading-5',
  md: 'min-h-11 rounded-control px-5 py-2.5 text-sm leading-5',
  lg: 'min-h-12 rounded-control px-6 py-3 text-[15px] leading-5',
}

function controlClasses(variant: Variant, size: Size, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 text-center break-keep font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    variants[variant],
    sizes[size],
    className,
  )
}

type ControlProps = { variant?: Variant; size?: Size }
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ControlProps

export function Button({ variant = 'primary', size = 'lg', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={controlClasses(variant, size, className)} {...props} />
}

type ButtonLinkProps = Omit<LinkProps, 'children'> & ControlProps & { children: ReactNode }

export function ButtonLink({ variant = 'primary', size = 'lg', className, ...props }: ButtonLinkProps) {
  return <Link className={controlClasses(variant, size, className)} {...props} />
}
