import { useId, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import './wheel-picker.css'

export function WheelField({
  label,
  displayValue,
  icon,
  open,
  onOpenChange,
  compact = false,
  children,
}: {
  label: string
  displayValue: string
  icon: IconName
  open: boolean
  onOpenChange: (open: boolean) => void
  compact?: boolean
  children: ReactNode
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  function close() {
    onOpenChange(false)
    trigger.current?.focus({ preventScroll: true })
  }
  return (
    <div className="wheel-field" onKeyDown={(event) => {
      if (!open || event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }}>
      <span id={`${id}-label`} className="field-label">{label}</span>
      <button
        ref={trigger}
        type="button"
        className="wheel-field-trigger form-input"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={open ? `${id}-picker` : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span id={`${id}-value`}>{displayValue}</span>
        <Icon name={icon} size={16} motion={icon === 'chevronsVertical' ? undefined : 'draw'} className="text-subtle" />
      </button>
      {open && (
        <div id={`${id}-picker`} className={cn('wheel-picker', compact && 'wheel-picker-compact')} role="group" aria-label={label.endsWith('선택') ? label : `${label} 선택`}>
          <div className="wheel-picker-columns">{children}</div>
          <div className="wheel-picker-footer">
            <Button size="xs" variant="soft" onClick={close}>완료</Button>
          </div>
        </div>
      )}
    </div>
  )
}
