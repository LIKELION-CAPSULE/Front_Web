import { useId, useRef, useState, type CSSProperties } from 'react'
import { normalizeVerificationCode } from '@/shared/lib/verification-code'
import { Icon } from './Icon'
import './verification-code-input.css'

/** One accessible text field; the six visual slots share its native value and autofill. */
export function VerificationCodeInput({ value, onChange, invalid, describedBy, readOnly = false, verified = false, successLabel = '인증 완료', length = 6 }: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
  readOnly?: boolean
  verified?: boolean
  successLabel?: string
  length?: number
}) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [selection, setSelection] = useState(0)
  const id = useId()
  const active = Math.min(selection, value.length, length - 1)

  function select(index: number) {
    const field = input.current
    if (!field || readOnly || verified) return
    const start = Math.max(0, Math.min(index, value.length, length - 1))
    field.focus({ preventScroll: true })
    field.setSelectionRange(start, start < value.length ? start + 1 : start)
    setSelection(start)
  }

  return (
    <div
      ref={root}
      className="verification-code-input"
      data-focused={focused || undefined}
      data-invalid={invalid || undefined}
      data-readonly={readOnly && !verified || undefined}
      data-verified={verified || undefined}
      style={{ '--code-index': active, '--code-length': length } as CSSProperties}
      onPointerDown={(event) => {
        if (readOnly || verified) return
        const slots = root.current?.querySelectorAll<HTMLElement>('[data-code-slot]')
        if (!slots) return
        const index = Array.from(slots).findIndex(slot => event.clientX <= slot.getBoundingClientRect().right)
        event.preventDefault()
        select(index < 0 ? length - 1 : index)
      }}
    >
      <label htmlFor={id} className="sr-only" aria-hidden={verified || undefined}>이메일 인증번호 {length}자리</label>
      <input
        id={id}
        ref={input}
        value={value}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={length}
        readOnly={readOnly || verified}
        disabled={verified}
        tabIndex={verified ? -1 : undefined}
        aria-hidden={verified || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={(event) => setSelection(event.currentTarget.selectionStart ?? 0)}
        onChange={(event) => {
          const raw = event.currentTarget.value
          setSelection(normalizeVerificationCode(raw.slice(0, event.currentTarget.selectionStart ?? raw.length), length).length)
          onChange(normalizeVerificationCode(raw, length))
        }}
        onPaste={(event) => {
          if (readOnly || verified) return
          event.preventDefault()
          const code = normalizeVerificationCode(event.clipboardData.getData('text'), length)
          if (!code) return
          onChange(code)
          setSelection(Math.min(code.length, length - 1))
        }}
        onKeyDown={(event) => {
          if (readOnly || verified || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            select(event.key === 'Home' ? 0 : event.key === 'End' ? value.length : active + (event.key === 'ArrowLeft' ? -1 : 1))
          }
        }}
      />
      <div className="verification-code-slots" aria-hidden="true">
        {Array.from({ length }, (_, index) => (
          <span key={index} data-code-slot style={{ '--slot-index': index } as CSSProperties}>
            <span className="verification-code-digit">{value[index] ?? ''}</span>
            {focused && !readOnly && !verified && index === active && !value[index] && <i />}
          </span>
        ))}
      </div>
      <span className="verification-code-focus" aria-hidden="true" />
      {verified && <div role="status" className="verification-code-success">
        <Icon name="check" size={22} motion="draw" />
        <span>{successLabel}</span>
      </div>}
    </div>
  )
}
