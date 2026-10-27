import { useId, useRef } from 'react'
import { Icon } from './Icon'
import { WheelColumn } from './WheelColumn'
import './wheel-picker.css'

export function WheelSelectField<T extends string>({
  label,
  options,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: T) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value
  function close() {
    onOpenChange(false)
    trigger.current?.focus({ preventScroll: true })
  }
  return (
    <div
      className="wheel-field"
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        close()
      }}
    >
      <span id={`${id}-label`} className="wheel-field-label">{label}</span>
      <button
        ref={trigger}
        type="button"
        className="wheel-field-trigger form-input"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={open ? `${id}-picker` : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span id={`${id}-value`}>{selectedLabel}</span>
        <Icon name="chevronsVertical" size={16} className="text-subtle" />
      </button>
      {open && (
        <div id={`${id}-picker`} className="wheel-picker wheel-picker-compact" role="group" aria-label={`${label} 선택`}>
          <div className="wheel-picker-columns">
            <WheelColumn
              label={label}
              hideLabel
              options={options}
              value={value}
              onChange={(next) => {
                const option = options.find((item) => item.value === next)
                if (option) onChange(option.value)
              }}
            />
          </div>
          <div className="wheel-picker-footer">
            <button type="button" className="wheel-picker-done" onClick={close}>완료</button>
          </div>
        </div>
      )}
    </div>
  )
}
