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

/**
 * The log as the call screen shows it (P1 「픽셀 대화 기록」, 2026-11-28): runs of lines (above), day dividers and the
 * app's own notes (a stage-up line) in time order.
 * - A divider (「오늘 23:39」) opens the log and comes again when the day changes or 30 quiet minutes pass, counted
 *   between items with known times.
 * - A note goes after the last line not newer than it (lines without a time — a reply still streaming in — are newest)
 *   and ends the run it falls in.
 */
export const CHAT_SESSION_GAP_MS = 30 * 60_000

export type ChatNote = { id: string; at: number }
export type ChatTimelineItem<T extends ChatGroupLine, N extends ChatNote> =
  | { kind: 'divider'; key: string; at: number }
  | { kind: 'note'; key: string; note: N }
  | ({ kind: 'group' } & ChatGroup<T>)

const dayKey = (at: number) => {
  const date = new Date(at)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function chatTimeline<T extends ChatGroupLine, N extends ChatNote>(lines: readonly T[], notes: readonly N[] = []): ChatTimelineItem<T, N>[] {
  const items: ChatTimelineItem<T, N>[] = []
  const waiting = [...notes].sort((a, b) => a.at - b.at)
  // Closures change these, so they live in one object (control-flow narrowing would not see the changes).
  const at: { last: number | null; run: ({ kind: 'group' } & ChatGroup<T>) | null } = { last: null, run: null }
  const divide = (time: number | undefined, key: string) => {
    if (time === undefined) return
    if (at.last === null || time - at.last >= CHAT_SESSION_GAP_MS || dayKey(time) !== dayKey(at.last)) {
      items.push({ kind: 'divider', key: `divider:${key}`, at: time })
      at.run = null
    }
    at.last = time
  }
  const flush = (until: number) => {
    while (waiting.length && waiting[0]!.at <= until) {
      const note = waiting.shift()!
      divide(note.at, note.id)
      items.push({ kind: 'note', key: `note:${note.id}`, note })
      at.run = null
    }
  }
  for (const line of lines) {
    if (line.createdAt !== undefined) flush(line.createdAt)
    divide(line.createdAt, line.id)
    const run = at.run
    const previous = run?.lines.at(-1)
    const apart = previous?.createdAt !== undefined && line.createdAt !== undefined && line.createdAt - previous.createdAt > CHAT_GROUP_GAP_MS
    if (run && previous && run.sender === line.sender && !apart) run.lines.push(line)
    else {
      at.run = { kind: 'group', key: line.id, sender: line.sender, lines: [line] }
      items.push(at.run)
    }
  }
  flush(Infinity)
  return items
}

const clockFormat = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
const yearDateFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

/** A line's time, 24-hour (「23:39」): the run's last line shows it, the others on hover / focus. */
export const chatClock = (at: number) => clockFormat.format(at)

/** A divider's words against `now`: 「오늘 23:39」, 「어제 22:10」, 「11월 25일 21:00」 (another year: with the year). */
export function chatDividerLabel(at: number, now = Date.now()) {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const day = dayKey(at) === dayKey(now)
    ? '오늘'
    : dayKey(at) === dayKey(yesterday.getTime())
      ? '어제'
      : new Date(at).getFullYear() === new Date(now).getFullYear() ? dateFormat.format(at) : yearDateFormat.format(at)
  return `${day} ${chatClock(at)}`
}

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
