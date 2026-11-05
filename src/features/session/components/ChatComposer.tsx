import { useLayoutEffect, useRef } from 'react'
import { Icon } from '@/shared/ui/Icon'

function resizeInput(field: HTMLTextAreaElement) {
  if (field.clientWidth === 0) return
  field.style.height = 'auto'
  field.style.height = `${Math.min(120, Math.max(24, field.scrollHeight))}px`
}

export function ChatComposer({ name, text, onChange, onSend, sendDisabled }: {
  name: string
  text: string
  onChange: (text: string) => void
  onSend: (text: string) => Promise<boolean>
  sendDisabled: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const submitting = useRef(false)
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
    if (sendDisabled || submitting.current || !text.trim()) return
    submitting.current = true
    try { await onSend(text) }
    finally { submitting.current = false }
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
        placeholder={`${name}에게 한마디…`}
      />
      <div className="session-chat-composer-tools">
        <button type="submit" className="session-chat-send" aria-label="메시지 보내기" disabled={sendDisabled || !text.trim()}>
          <Icon name="arrow" size={18} />
        </button>
      </div>
    </form>
  )
}
