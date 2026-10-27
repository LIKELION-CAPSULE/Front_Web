import { useRef, type MouseEventHandler } from 'react'
import { Icon } from './Icon'
import { cn } from '@/shared/lib/cn'
import './control-motion.css'

/** Native toggle semantics with an original pop and a small save-only burst. */
export function BookmarkButton({
  pressed,
  label,
  onClick,
  className,
}: {
  pressed: boolean
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  className?: string
}) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const burstRef = useRef<SVGSVGElement>(null)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cn('bookmark-button', className)}
      onClick={(event) => {
        onClick(event)
        if (event.defaultPrevented || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          return
        const icon = iconRef.current
        if (!icon || typeof icon.animate !== 'function') return
        icon.getAnimations().forEach((animation) => animation.cancel())
        icon.animate(
          pressed
            ? [
                { transform: 'scale(1)' },
                { transform: 'scale(.82) rotate(-6deg)' },
                { transform: 'scale(1)' },
              ]
            : [
                { transform: 'scale(.78) rotate(-12deg)' },
                { transform: 'scale(1.24) rotate(7deg)', offset: 0.42 },
                { transform: 'scale(.94) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1) rotate(0)' },
              ],
          { duration: pressed ? 240 : 420, easing: 'cubic-bezier(.2,.7,.3,1)' },
        )
        const burst = burstRef.current
        burst?.getAnimations().forEach((animation) => animation.cancel())
        if (!pressed)
          burst?.animate(
            [
              { opacity: 0, transform: 'scale(.55)' },
              { opacity: 0.9, offset: 0.22 },
              { opacity: 0, transform: 'scale(1.22)' },
            ],
            { duration: 440, easing: 'ease-out' },
          )
      }}
    >
      <svg ref={burstRef} className="bookmark-burst" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 3v4m0 26v4M3 20h4m26 0h4M8 8l3 3m18 18 3 3M8 32l3-3m18-18 3-3" />
      </svg>
      <span ref={iconRef} className="bookmark-symbol">
        <Icon name="bookmark" size={18} fill={pressed ? 'currentColor' : 'none'} />
      </span>
    </button>
  )
}
