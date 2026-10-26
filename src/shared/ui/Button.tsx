import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary'

const variants: Record<Variant, string> = {
  primary: 'button-primary text-white',
  secondary: 'button-secondary border border-line bg-panel text-ink enabled:hover:bg-surface',
}

function controlClasses(variant: Variant, className?: string) {
  return cn(
    'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-control px-6 py-3 text-[15px] leading-6 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45',
    variants[variant],
    className,
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={controlClasses(variant, className)} {...props} />
}

type ButtonLinkProps = Omit<LinkProps, 'children'> & { children: ReactNode; variant?: Variant }

export function ButtonLink({ variant = 'primary', className, ...props }: ButtonLinkProps) {
  return <Link className={cn(controlClasses(variant, className), 'hover:opacity-90')} {...props} />
}
