import { useEffect, useRef } from 'react'
import { useWindupString } from 'windups'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { speechPace } from '../speech-pace'
import '../character-speech-bubble.css'

/**
 * The character's on-screen line (event reactions only; chat replies stay in the chat panel).
 * The line types out with pauses at punctuation; a click shows it at once. Mount with a new `key` for each line so a
 * new line restarts from the beginning.
 *
 * `onTypingChange` reports when letters are actually appearing: on while the line types, off when it finishes, is
 * skipped (click) or the bubble goes away (a new line or unmount). The connection screen moves the mate's mouth by it.
 */
export function CharacterSpeechBubble({ name, text, expanded = false, variant = 'default', speakerLabel, onDismiss, onTypingChange }: {
  name: string
  text: string
  expanded?: boolean
  variant?: 'default' | 'pill'
  speakerLabel?: string
  onDismiss?: () => void
  onTypingChange?: (typing: boolean) => void
}) {
  const reduced = useReducedMotion()
  const [typed, { skip, isFinished }] = useWindupString(text, { pace: speechPace, skipped: reduced })
  const report = useRef(onTypingChange)
  useEffect(() => { report.current = onTypingChange }, [onTypingChange])
  const typing = !isFinished && !reduced && text.length > 0
  useEffect(() => {
    if (!typing) return
    report.current?.(true)
    return () => report.current?.(false)
  }, [typing])
  return <blockquote
    className={variant === 'pill' ? 'character-speech-bubble character-speech-bubble--pill' : 'character-speech-bubble'}
    aria-label={`${name}의 한마디`}
    data-expanded={expanded || undefined}
    data-typing={!isFinished || undefined}
    onClick={isFinished ? undefined : skip}
  >
    {speakerLabel && <span className="character-speech-bubble-speaker">{speakerLabel}</span>}
    <p className="character-speech-bubble-text">
      <span className="sr-only">{text}</span>
      {/* The full line reserves the final size so the bubble does not grow while typing. */}
      <span className="character-speech-bubble-measure" aria-hidden="true">{text}</span>
      <span className="character-speech-bubble-typed" aria-hidden="true">{typed}</span>
    </p>
    {onDismiss && <button type="button" className="character-speech-bubble-dismiss" onClick={onDismiss}>아니야</button>}
  </blockquote>
}
