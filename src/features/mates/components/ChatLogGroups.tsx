import type { ReactNode } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { chatClock, chatDividerLabel, chatTimeline, type ChatGroupLine, type ChatNote } from '../chat-groups'
import '../chat-log.css'

type Line = ChatGroupLine & { text: string }

function MateFace({ src }: { src?: string }) {
  return <span className="chat-log-face" aria-hidden="true">
    {src ? <img src={src} width={32} height={32} alt="" draggable={false} /> : <Icon name="user" size={16} />}
  </span>
}

/** Her reply on its way: three square dots (the dialogue box's, a pixel point kept on purpose), read as a status. */
function PixelDots({ name }: { name: string }) {
  return <span role="status" className="chat-log-dots">
    <span aria-hidden="true"><span /><span /><span /></span>
    <span className="sr-only">{name}님이 답장을 준비하고 있어요.</span>
  </span>
}

/**
 * The call screen's chat log (2026-11-28; chat-groups.ts `chatTimeline`; P1 toned down to pixel points): day dividers
 * (「오늘 23:39」), her runs with a round face and her name once (small text), mine on the right with my name for screen
 * readers only; round bubbles with C3's run corners (no tail); the run's last line shows its time (the others on hover /
 * focus); the app's notes (`notes` + `renderNote`: the stage-up line) in time order; while her reply is on its way,
 * three square dots in her run. Each line is one `article[data-message-id]` (the older-page anchor finds lines by it).
 * `renderText` and `renderActions` keep the page's own parts (typing, reported replies, 👍 / 👎 / 신고).
 */
export function ChatLogGroups<T extends Line, N extends ChatNote = ChatNote>({ lines, mateName, mateFace, userName, typing, renderText, renderActions, notes, renderNote, now }: {
  lines: readonly T[]
  mateName: string
  mateFace?: string
  userName: string
  typing: boolean
  renderText?: (line: T) => ReactNode
  renderActions?: (line: T) => ReactNode
  notes?: readonly N[]
  renderNote?: (note: N) => ReactNode
  /** 「오늘」 / 「어제」 are counted against this (the page's clock); now when left out. */
  now?: number
}) {
  const items = chatTimeline(lines, notes)
  const last = items.at(-1)
  return <>
    {items.map(item => {
      if (item.kind === 'divider') return (
        <p key={item.key} className="chat-log-divider">
          <time dateTime={new Date(item.at).toISOString()}>{chatDividerLabel(item.at, now)}</time>
        </p>
      )
      if (item.kind === 'note') return <div key={item.key} className="chat-log-note">{renderNote?.(item.note)}</div>
      return (
        <div key={item.key} className="chat-log-group" data-sender={item.sender}>
          {item.sender === 'character' && <MateFace src={mateFace} />}
          <div className="chat-log-group-body">
            {item.sender === 'character'
              ? <span className="chat-log-name">{mateName}</span>
              : <span className="sr-only">{userName}</span>}
            {item.lines.map((line, index) => (
              <article
                key={line.id}
                data-message-id={line.id}
                data-sender={line.sender}
                data-first={index === 0 || undefined}
                data-last={index === item.lines.length - 1 || undefined}
              >
                <div className="chat-log-row">
                  <p className="chat-log-bubble">{renderText ? renderText(line) : line.text}</p>
                  {line.createdAt !== undefined && (
                    <time className="chat-log-time" dateTime={new Date(line.createdAt).toISOString()}>{chatClock(line.createdAt)}</time>
                  )}
                  {renderActions?.(line)}
                </div>
              </article>
            ))}
          </div>
        </div>
      )
    })}
    {typing && (
      <div className="chat-log-group" data-sender="character" data-typing>
        <MateFace src={mateFace} />
        <div className="chat-log-group-body">
          {(last?.kind !== 'group' || last.sender !== 'character') && <span className="chat-log-name">{mateName}</span>}
          <article data-first data-last>
            <div className="chat-log-row">
              <p className="chat-log-bubble chat-log-bubble--typing"><PixelDots name={mateName} /></p>
            </div>
          </article>
        </div>
      </div>
    )}
  </>
}
