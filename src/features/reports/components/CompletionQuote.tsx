import { useRef } from 'react'
import { TypingMessage } from '@/features/session/components/TypingMessage'

function ignoreTypingProgress() {}

export function CompletionQuote({ id, text }: { id: string; text: string }) {
  const seen = useRef(new Set<string>())
  return (
    <blockquote className="report-friend-quote">
      <span className="report-quote-measure" aria-hidden="true">{text}</span>
      <TypingMessage key={id} id={id} text={text} seen={seen} onProgress={ignoreTypingProgress} onTypingChange={ignoreTypingProgress} />
    </blockquote>
  )
}
