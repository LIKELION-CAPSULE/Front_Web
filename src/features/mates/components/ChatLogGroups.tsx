import type { ReactNode } from 'react'
import { TypingIndicator } from '@/features/session/components/TypingIndicator'
import { Icon } from '@/shared/ui/Icon'
import { chatLineTime, groupChatLines, type ChatGroupLine } from '../chat-groups'
import '../chat-log.css'

type Line = ChatGroupLine & { text: string }

function MateFace({ src }: { src?: string }) {
  return src
    ? <img src={src} width={32} height={32} alt="" className="chat-log-face" draggable={false} />
    : <span className="chat-log-face" aria-hidden="true"><Icon name="user" size={16} /></span>
}

/**
 * The call screen's chat lines in runs (chat-groups.ts): her runs with her face and her name once, mine on the right
 * with my name for screen readers only; the time shows on hover / focus; while her reply is on its way, the typing dots
 * in her run. Each line is one `article[data-message-id]` (the older-page anchor finds lines by it).
 * `renderText` and `renderActions` keep the page's own parts (typing, reported replies, 👍 / 👎 / 신고).
 */
export function ChatLogGroups<T extends Line>({ lines, mateName, mateFace, userName, typing, renderText, renderActions }: {
  lines: readonly T[]
  mateName: string
  mateFace?: string
  userName: string
  typing: boolean
  renderText?: (line: T) => ReactNode
  renderActions?: (line: T) => ReactNode
}) {
  const groups = groupChatLines(lines)
  return <>
    {groups.map(group => (
      <div key={group.key} className="chat-log-group" data-sender={group.sender}>
        {group.sender === 'character' && <MateFace src={mateFace} />}
        <div className="chat-log-group-body">
          {group.sender === 'character'
            ? <span className="chat-log-name">{mateName}</span>
            : <span className="sr-only">{userName}</span>}
          {group.lines.map((line, index) => (
            <article
              key={line.id}
              data-message-id={line.id}
              data-sender={line.sender}
              data-first={index === 0 || undefined}
              data-last={index === group.lines.length - 1 || undefined}
            >
              <div className="chat-log-row">
                <p className="chat-log-bubble">{renderText ? renderText(line) : line.text}</p>
                {line.createdAt !== undefined && (
                  <time className="chat-log-time" dateTime={new Date(line.createdAt).toISOString()}>{chatLineTime(line.createdAt)}</time>
                )}
                {renderActions?.(line)}
              </div>
            </article>
          ))}
        </div>
      </div>
    ))}
    {typing && (
      <div className="chat-log-group" data-sender="character" data-typing>
        <MateFace src={mateFace} />
        <div className="chat-log-group-body">
          {groups.at(-1)?.sender !== 'character' && <span className="chat-log-name">{mateName}</span>}
          <div className="chat-log-row">
            <p className="chat-log-bubble chat-log-bubble--typing"><TypingIndicator name={mateName} /></p>
          </div>
        </div>
      </div>
    )}
  </>
}
