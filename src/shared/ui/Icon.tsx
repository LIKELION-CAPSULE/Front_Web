import { useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react'
import { animatedIcons, type IconName } from './animate-icons/icons'
import { cn } from '@/shared/lib/cn'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import './icon.css'

export type { IconName } from './animate-icons/icons'

/** All product icons come from the AnimateIcons Lucide catalog. */
export function Icon({ name, size = 20, fill = 'none', loop = false, className, style, ...props }: ComponentPropsWithoutRef<'span'> & {
  name: IconName
  size?: number
  fill?: 'none' | 'currentColor'
  /** Automatically repeat the Heart artwork's original heartbeat. */
  loop?: boolean
}) {
  const host = useRef<HTMLSpanElement>(null)
  const animation = useRef<{ startAnimation: () => void; stopAnimation: () => void }>(null)
  const reduced = useReducedMotion()
  const Artwork = animatedIcons[name]
  const loopingHeart = name === 'heart' && loop

  useEffect(() => {
    const root = host.current
    if (!root || loopingHeart) return
    const control = root.closest<HTMLElement>('button, a, label, [role="button"], [data-icon-trigger]') ?? root
    const blocked = () => reduced || !!control.closest('[inert], :disabled, [aria-disabled="true"]')
    const start = () => { if (!blocked()) animation.current?.startAnimation() }
    const stop = () => { animation.current?.stopAnimation() }
    const leave = () => { if (!control.matches(':focus-visible') && !control.contains(document.activeElement)) stop() }
    const blur = () => { if (!control.matches(':hover')) stop() }
    if (reduced) stop()
    control.addEventListener('pointerenter', start)
    control.addEventListener('pointerleave', leave)
    control.addEventListener('focusin', start)
    control.addEventListener('focusout', blur)
    if (control.hasAttribute('data-icon-trigger')) control.addEventListener('click', start)
    return () => {
      control.removeEventListener('pointerenter', start)
      control.removeEventListener('pointerleave', leave)
      control.removeEventListener('focusin', start)
      control.removeEventListener('focusout', blur)
      control.removeEventListener('click', start)
    }
  }, [name, reduced, loopingHeart])

  return (
    <span ref={host} aria-hidden="true" data-icon={name} className={cn('app-icon', className)} style={{ '--icon-size': `${size}px`, ...style } as CSSProperties} {...props}>
      <Artwork ref={animation} size={size} isAnimated={!reduced} style={{ fill }} {...(loopingHeart ? { loop: true } : {})} />
    </span>
  )
}
