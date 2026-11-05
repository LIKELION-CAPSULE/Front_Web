import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { normalizeVerificationCode } from '@/shared/lib/verification-code'
import './verification-code-input.css'

/** One accessible text field; the six visual slots share its native value and autofill. */
export function VerificationCodeInput({ value, onChange, invalid, describedBy, readOnly = false, length = 6 }: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
  readOnly?: boolean
  length?: number
}) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const nextSelection = useRef<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [selection, setSelection] = useState(0)
  const id = useId()
  const active = Math.min(selection, value.length, length - 1)

  useLayoutEffect(() => {
    const field = input.current
    if (!field || nextSelection.current === null || readOnly) return
    const start = Math.min(nextSelection.current, value.length, length - 1)
    nextSelection.current = null
    if (document.activeElement === field) field.setSelectionRange(start, start < value.length ? start + 1 : start)
  }, [value, selection, readOnly, length])

  function select(index: number) {
    const field = input.current
    if (!field || readOnly) return
    const start = Math.max(0, Math.min(index, value.length, length - 1))
    field.focus({ preventScroll: true })
    field.setSelectionRange(start, start < value.length ? start + 1 : start)
    setSelection(start)
  }

  function change(field: HTMLInputElement) {
    if (readOnly) return
    const raw = field.value
    const code = normalizeVerificationCode(raw, length)
    const caret = normalizeVerificationCode(raw.slice(0, field.selectionStart ?? raw.length), length).length
    nextSelection.current = Math.min(caret, length - 1)
    setSelection(nextSelection.current)
    onChange(code)
  }

  return (
    <div
      ref={root}
      className="verification-code-input"
      data-focused={focused || undefined}
      data-invalid={invalid || undefined}
      data-readonly={readOnly || undefined}
      style={{ '--code-index': active, '--code-length': length } as CSSProperties}
      onPointerDown={(event) => {
        if (readOnly) return
        const slots = root.current?.querySelectorAll<HTMLElement>('[data-code-slot]')
        if (!slots) return
        const index = Array.from(slots).findIndex(slot => event.clientX <= slot.getBoundingClientRect().right)
        event.preventDefault()
        select(index < 0 ? length - 1 : index)
      }}
    >
      <label htmlFor={id} className="sr-only">이메일 인증번호 {length}자리</label>
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
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={(event) => setSelection(event.currentTarget.selectionStart ?? 0)}
        onChange={event => change(event.currentTarget)}
        onInput={event => {
          // React skips onChange when a selected digit is replaced with itself.
          if (event.currentTarget.value === value) change(event.currentTarget)
        }}
        onPaste={(event) => {
          if (readOnly) return
          event.preventDefault()
          const code = normalizeVerificationCode(event.clipboardData.getData('text'), length)
          if (!code) return
          nextSelection.current = Math.min(code.length, length - 1)
          setSelection(nextSelection.current)
          onChange(code)
        }}
        onKeyDown={(event) => {
          if (readOnly || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            select(event.key === 'Home' ? 0 : event.key === 'End' ? value.length : active + (event.key === 'ArrowLeft' ? -1 : 1))
          }
        }}
      />
      <div className="verification-code-slots" aria-hidden="true">
        {Array.from({ length }, (_, index) => (
          <span key={index} data-code-slot>
            <span className="verification-code-digit">{value[index] ?? ''}</span>
            {focused && !readOnly && index === active && !value[index] && <i />}
          </span>
        ))}
      </div>
      <span className="verification-code-focus" aria-hidden="true" />
    </div>
  )
}
