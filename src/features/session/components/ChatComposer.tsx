import { useId, useLayoutEffect, useRef } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import '../chat-composer.css'

function resizeInput(field: HTMLTextAreaElement) {
  if (field.clientWidth === 0) return
  field.style.height = 'auto'
  field.style.height = `${Math.min(120, Math.max(24, field.scrollHeight))}px`
}

/** 「누르고 말하기」 inside the input: held with the pointer, Space or Enter (the call screen's usePushToTalk). */
export interface ComposerTalk {
  supported: boolean
  listening: boolean
  disabled: boolean
  /** The button's name and tooltip (e.g. 「누르고 말하기」, 「듣는 중 · 떼면 보내요」, or why it cannot be used). */
  label: string
  onPressStart: () => void
  onPressEnd: () => void
}

/**
 * The chat box. The call screen (2026-11-27 call UI step 1) adds quick replies above it, 「누르고 말하기」 inside it, the
 * key hint below it and the send button's states: off (grey) while there is nothing to send or sending is not possible,
 * 「답장을 기다리는 중」 (a spinner; `waiting`) while her reply is on its way — typing goes on meanwhile.
 */
export function ChatComposer({ name, text, onChange, onSend, sendDisabled, waiting = false, talk, quickReplies, onQuickReply, hint = false }: {
  name: string
  text: string
  onChange: (text: string) => void
  onSend: (text: string) => Promise<boolean>
  sendDisabled: boolean
  /** Her reply is on its way (the send button shows it). */
  waiting?: boolean
  talk?: ComposerTalk
  quickReplies?: readonly string[]
  onQuickReply?: (text: string) => void
  /** 「Enter 보내기 · Shift+Enter 줄바꿈」 under the box. */
  hint?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const submitting = useRef(false)
  const hintId = useId()
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
  const sendState = waiting ? 'waiting' : sendDisabled || !text.trim() ? 'off' : 'ready'
  const talkOff = !talk?.supported || talk.disabled
  const form = (
    <form className="session-chat-composer" data-has-text={!!text || undefined} data-listening={talk?.listening || undefined} onSubmit={(event) => { event.preventDefault(); void submit() }}>
      {talk && (
        <button
          type="button"
          className="session-chat-talk"
          aria-label={talk.label}
          title={talk.label}
          data-listening={talk.listening || undefined}
          disabled={talkOff}
          // The same press as the dock's button: pointer down / up (captured), Space / Enter down / up, never longer
          // than the focus (GlassDock's press-and-hold).
          onPointerDown={(event) => {
            if (event.button !== 0 || talkOff) return
            event.preventDefault()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            talk.onPressStart()
          }}
          onPointerUp={() => talk.onPressEnd()}
          onPointerCancel={() => talk.onPressEnd()}
          onLostPointerCapture={() => talk.onPressEnd()}
          onBlur={() => talk.onPressEnd()}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return
            event.preventDefault()
            if (!event.repeat && !talkOff) talk.onPressStart()
          }}
          onKeyUp={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return
            event.preventDefault()
            talk.onPressEnd()
          }}
        >
          <Icon name="microphone" size={18} />
        </button>
      )}
      <textarea
        ref={ref}
        rows={1}
        aria-label={`${name}에게 메시지`}
        aria-describedby={hint ? hintId : undefined}
        value={text}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submit() }
        }}
        maxLength={300}
        placeholder={`${name}에게 한마디…`}
      />
      <div className="session-chat-composer-tools">
        <button
          type="submit"
          className="session-chat-send"
          data-state={sendState}
          aria-label="메시지 보내기"
          aria-busy={waiting || undefined}
          aria-describedby={hint ? hintId : undefined}
          disabled={sendState !== 'ready'}
        >
          {waiting ? <QuarterRingSpinner className="session-chat-send-spinner" /> : <Icon name="arrow" size={18} />}
        </button>
      </div>
    </form>
  )
  if (!quickReplies?.length && !hint) return form
  return (
    <div className="session-chat-composer-wrap">
      {quickReplies && quickReplies.length > 0 && (
        <div className="session-chat-quick" role="group" aria-label="빠른 답장">
          {quickReplies.map(reply => (
            <button key={reply} type="button" disabled={sendDisabled} onClick={() => onQuickReply?.(reply)}>{reply}</button>
          ))}
        </div>
      )}
      {form}
      {hint && (
        <p id={hintId} className="session-chat-hint">
          {waiting
            ? '답장을 기다리는 중이에요'
            : <><kbd>Enter</kbd> 보내기 · <kbd>Shift</kbd>+<kbd>Enter</kbd> 줄바꿈</>}
        </p>
      )}
    </div>
  )
}
