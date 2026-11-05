import '../typing-indicator.css'

/** Three staggered wave dots, following https://www.loading-ui.com/docs/components/typing. */
export function TypingIndicator({ name }: { name: string }) {
  return <span role="status" className="chat-typing-indicator">
    <span aria-hidden="true" className="chat-typing-dots"><span /><span /><span /></span>
    <span className="sr-only">{name}님이 답장을 준비하고 있어요.</span>
  </span>
}
