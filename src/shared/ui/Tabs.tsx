import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import './tabs.css'

type Tab = { id: string; label: string }
export type TabSize = 'sm' | 'md'
export function Tabs({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: readonly Tab[]
  value: string
  onChange: (value: string) => void
  label: string
  size?: TabSize
}) {
  const controlRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const control = controlRef.current
    const indicator = indicatorRef.current
    if (!control || !indicator) return
    let mounted = true
    function measure() {
      if (!mounted || !control || !indicator) return
      const selected = control.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      indicator.hidden = !selected
      if (!selected) return
      indicator.style.width = `${selected.offsetWidth}px`
      indicator.style.height = `${selected.offsetHeight}px`
      indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`
    }
    measure()
    const frame = requestAnimationFrame(() => {
      indicator.dataset.ready = 'true'
    })
    const observer = new ResizeObserver(measure)
    observer.observe(control)
    control.querySelectorAll('button').forEach((button) => observer.observe(button))
    void document.fonts.ready.then(measure)
    return () => {
      mounted = false
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [value, options, size])
  return (
    <div
      ref={controlRef}
      role="group"
      aria-label={label}
      className="segmented-control inline-flex max-w-full flex-wrap gap-1 rounded-control bg-panel p-1"
    >
      <span ref={indicatorRef} className="segmented-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'segmented-option rounded-[9px] py-2 leading-5 transition-colors',
            size === 'sm' ? 'px-3 text-xs' : 'px-4 text-sm',
            value === option.id ? 'font-bold text-brand-strong' : 'text-subtle hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
