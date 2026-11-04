import { useLayoutEffect, useRef } from 'react'
import { Icon } from '@/shared/ui/Icon'

function resizeInput(field: HTMLTextAreaElement) {
  if (field.clientWidth === 0) return
  field.style.height = 'auto'
  field.style.height = `${Math.min(120, Math.max(24, field.scrollHeight))}px`
}

export function ChatComposer({ name, text, onChange, onSend, disabled }: {
  name: string
  text: string
  onChange: (text: string) => void
  onSend: (text: string) => Promise<boolean>
  disabled: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    resizeInput(field)
  }, [text, name])
  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    let width = -1
    // The dialog opens after its children mount, and its width then animates.
    // Re-measure only width changes so height updates cannot cause an observer loop.
    const observer = new ResizeObserver(() => {
      const next = field.clientWidth
      if (next === width) return
      width = next
      resizeInput(field)
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [])
  async function submit() {
    if (disabled || !text.trim()) return
    if (await onSend(text)) onChange('')
  }
  return (
    <form className="session-chat-composer" data-has-text={!!text || undefined} onSubmit={(event) => { event.preventDefault(); void submit() }}>
      <textarea
        ref={ref}
        rows={1}
        aria-label={`${name}에게 메시지`}
        value={text}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submit() }
        }}
        maxLength={300}
        disabled={disabled}
        placeholder={`${name}에게 한마디…`}
      />
      <div className="session-chat-composer-tools">
        <button type="submit" className="session-chat-send" aria-label="메시지 보내기" disabled={disabled || !text.trim()}>
          <Icon name="arrow" size={18} />
        </button>
      </div>
    </form>
  )
}
