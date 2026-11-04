import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from './Icon'
import './tabs.css'

type Tab = { id: string; label: string; icon?: IconName; controls?: string }
export type TabSize = 'sm' | 'md'
export function Tabs({
  options,
  value,
  onChange,
  label,
  size = 'md',
  iconOnly = false,
}: {
  options: readonly Tab[]
  value: string
  onChange: (value: string) => void
  label: string
  size?: TabSize
  iconOnly?: boolean
}) {
  const controlRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const control = controlRef.current
    const indicator = indicatorRef.current
    if (!control || !indicator) return
    let mounted = true
    let frame = 0
    function measure() {
      if (!mounted || !control || !indicator) return
      const selected = control.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      const visible = control.getClientRects().length > 0
      indicator.hidden = !selected || !visible
      if (!selected || !visible) {
        // A hidden panel must reveal its indicator at the selected button's final bounds.
        delete indicator.dataset.ready
        cancelAnimationFrame(frame)
        return
      }
      indicator.style.width = `${selected.offsetWidth}px`
      indicator.style.height = `${selected.offsetHeight}px`
      indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`
      if (!indicator.dataset.ready) {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => { indicator.dataset.ready = 'true' })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(control)
    control.querySelectorAll('button').forEach((button) => observer.observe(button))
    void document.fonts.ready.then(measure)
    return () => {
      mounted = false
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [value, options, size, iconOnly])
  return (
    <div
      ref={controlRef}
      role="group"
      aria-label={label}
      className={cn('segmented-control inline-flex max-w-full flex-wrap gap-1 rounded-control bg-panel p-1', iconOnly && 'shrink-0 flex-nowrap')}
    >
      <span ref={indicatorRef} className="segmented-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          aria-controls={option.controls}
          title={iconOnly ? option.label : undefined}
          onClick={() => onChange(option.id)}
          className={cn(
            'segmented-option rounded-[9px] py-2 leading-5 transition-colors max-md:min-h-11',
            iconOnly && option.icon ? 'inline-flex size-11 items-center justify-center p-0' : size === 'sm' ? 'px-3 text-caption' : 'px-4 text-body-compact',
            value === option.id ? 'font-bold text-text-accent' : 'text-subtle hover:text-ink',
          )}
        >
          {option.icon && <Icon name={option.icon} size={20} />}
          <span className={iconOnly && option.icon ? 'sr-only' : undefined}>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
