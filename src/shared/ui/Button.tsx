import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white enabled:hover:bg-ink/90',
  secondary: 'border border-line bg-canvas text-ink enabled:hover:bg-surface',
}

function controlClasses(variant: Variant, className?: string) {
  return cn(
    'inline-flex min-h-14 items-center justify-center rounded-control px-7 py-3.5 text-[17px] leading-6 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
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
