/**
 * The call screen's chat in runs (2026-11-27, call UI step 1): consecutive lines of one side form a group — one name
 * and one face for the group, the bubbles stacked under it. A gap of more than three minutes between two lines with
 * known times starts a new group; lines without a time (a reply still streaming in) stay with their side's run.
 */

export const CHAT_GROUP_GAP_MS = 3 * 60_000

export type ChatGroupLine = { id: string; sender: 'user' | 'character'; createdAt?: number }
export type ChatGroup<T extends ChatGroupLine> = { key: string; sender: T['sender']; lines: T[] }

export function groupChatLines<T extends ChatGroupLine>(lines: readonly T[]): ChatGroup<T>[] {
  const groups: ChatGroup<T>[] = []
  for (const line of lines) {
    const group = groups.at(-1)
    const previous = group?.lines.at(-1)
    const apart = previous?.createdAt !== undefined && line.createdAt !== undefined && line.createdAt - previous.createdAt > CHAT_GROUP_GAP_MS
    if (group && previous && group.sender === line.sender && !apart) group.lines.push(line)
    else groups.push({ key: line.id, sender: line.sender, lines: [line] })
  }
  return groups
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })
/** A line's time as shown on hover (「오후 3:05」). */
export const chatLineTime = (at: number) => timeFormat.format(at)

/**
 * 「새 메시지 ↓」: how many of her lines arrived at the end of the chat since `previousLastId` while the reader was not
 * following the newest line. Lines landing above (an older page) or her line growing (streaming) count nothing.
 */
export function unreadArrivals(lines: readonly Pick<ChatGroupLine, 'id' | 'sender'>[], previousLastId: string | undefined, following: boolean): number {
  if (following || previousLastId === undefined) return 0
  const last = lines.at(-1)
  if (!last || last.id === previousLastId) return 0
  const from = lines.findIndex(line => line.id === previousLastId)
  // The previous last line is gone (history replaced): only the new last line, if it is hers.
  const arrived = from >= 0 ? lines.slice(from + 1) : [last]
  return arrived.filter(line => line.sender === 'character').length
}
