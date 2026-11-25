import type { Message } from '../demo/types.ts'
import type { ChatMessage, ChatRoomResponse } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'

/**
 * 32 대화방 (`GET /mates/{mateId}/messages`, newest first, cursor pages) for the call screen's chat panel.
 *
 * What the panel shows: the server's history (every page loaded so far) and, on top, this browser's messages of the
 * connection running now (lines still on their way, a reply streaming in). Where both hold the same line (same
 * `requestId` and sender) it is shown once. Lines of earlier connections come from the server only, so what 32 leaves
 * out — a line that got no reply, a reported reply, a reset conversation — stays out (the server's rule).
 *
 * Also kept here per mate: the ratings (40) and reports (41) of replies, starting from 32 `rating`.
 */

export type ReplyRating = 'UP' | 'DOWN' | null
export type ChatRoomState = {
  /** Oldest first. */
  messages: readonly Message[]
  nextCursor: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  ratings: Readonly<Record<string, ReplyRating>>
  /** Replies this browser reported (folded until the next read leaves them out). */
  reported: ReadonlySet<string>
}

const empty: ChatRoomState = { messages: [], nextCursor: null, status: 'idle', ratings: {}, reported: new Set() }
const rooms = new Map<string, ChatRoomState>()
const listeners = new Set<() => void>()
const roomKey = (userId: number | string, characterId: string) => `${userId}:${characterId}`

export function chatRoomSnapshot(userId: number | string | undefined, characterId: string | undefined): ChatRoomState {
  return userId !== undefined && characterId ? rooms.get(roomKey(userId, characterId)) ?? empty : empty
}
export function subscribeChatRooms(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function update(userId: number | string, characterId: string, change: (room: ChatRoomState) => ChatRoomState) {
  const key = roomKey(userId, characterId)
  rooms.set(key, change(rooms.get(key) ?? empty))
  for (const listener of listeners) listener()
}

/** 47 reset (or another account): this mate's room is read again from the start. */
export function forgetChatRoom(userId: number | string, characterId: string) {
  if (!rooms.delete(roomKey(userId, characterId))) return
  for (const listener of listeners) listener()
}
export function forgetAllChatRooms() {
  rooms.clear()
  for (const listener of listeners) listener()
}

const isRating = (value: unknown): value is ReplyRating => value === 'UP' || value === 'DOWN' || value === null

/** One 32 message as the app's message. Malformed items fail the page (502), like the other adapters. */
export function chatMessage(item: ChatMessage, characterId: string): Message & { rating: ReplyRating } {
  const createdAt = typeof item?.createdAt === 'string' ? Date.parse(item.createdAt) : NaN
  if (typeof item?.requestId !== 'string' || !item.requestId || (item.sender !== 'USER' && item.sender !== 'MATE') ||
    typeof item.content !== 'string' || !Number.isFinite(createdAt) || !(typeof item.connectionId === 'number' && item.connectionId > 0)) {
    throw new ApiError('대화 기록 응답을 확인하지 못했어요.', 502)
  }
  const sender = item.sender === 'USER' ? 'user' : 'character'
  return {
    id: `${item.requestId}:${sender === 'user' ? 'user' : 'reply'}`,
    requestId: item.requestId, sessionId: String(item.connectionId), characterId, sender, text: item.content, voice: false,
    delivery: 'confirmed', createdAt, rating: sender === 'character' && isRating(item.rating) ? item.rating : null,
  }
}

const order = (a: Message, b: Message) =>
  (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.requestId === b.requestId ? (a.sender === 'user' ? -1 : 1) : 0)

/**
 * The panel's list: the server's history, plus this browser's lines of the running connection that the server does not
 * list yet. A line in both keeps this browser's copy (its id keeps the typing state of a reply on screen). Oldest first.
 * Without any server history yet (not read, or the read failed), this browser's lines as before.
 */
export function mergeChatHistory(history: readonly Message[], local: readonly Message[], activeConnectionId: string | null, historyLoaded: boolean): Message[] {
  if (!historyLoaded) return [...local].sort(order)
  const localById = new Map(local.map(message => [message.id, message]))
  const result = history.map(message => localById.get(message.id) ?? message)
  const listed = new Set(history.map(message => message.id))
  for (const message of local) {
    if (listed.has(message.id)) continue
    // Earlier connections: the server's word (left out lines stay out). The running connection: this browser's lines.
    if (activeConnectionId !== null && message.sessionId === activeConnectionId) result.push(message)
  }
  return result.sort(order)
}

/** Adds an older page (32 `messages`, newest first) to what is loaded; a line already loaded is not added twice. */
export function appendOlderPage(loaded: readonly Message[], page: readonly Message[]): Message[] {
  const ids = new Set(loaded.map(message => message.id))
  return [...page.filter(message => !ids.has(message.id)), ...loaded].sort(order)
}

/** Reads the next older page (the first page when nothing is loaded). Ignored while one is on its way or at the end. */
export async function loadChatRoom(
  userId: number,
  characterId: string,
  read: (cursor: string | null) => Promise<ChatRoomResponse>,
  { fromStart = false }: { fromStart?: boolean } = {},
) {
  const current = chatRoomSnapshot(userId, characterId)
  if (current.status === 'loading') return
  if (!fromStart && current.status === 'ready' && current.nextCursor === null) return
  const cursor = fromStart || current.status !== 'ready' ? null : current.nextCursor
  update(userId, characterId, room => ({ ...room, status: 'loading' }))
  try {
    const response = await read(cursor)
    if (!response || !Array.isArray(response.messages)) throw new ApiError('대화 기록 응답을 확인하지 못했어요.', 502)
    const page = response.messages.map(item => chatMessage(item, characterId))
    update(userId, characterId, room => {
      const ratings = { ...room.ratings }
      for (const message of page) if (message.sender === 'character' && message.requestId && !(message.requestId in ratings)) ratings[message.requestId] = message.rating
      return {
        ...room,
        messages: cursor === null ? appendOlderPage([], page) : appendOlderPage(room.messages, page),
        nextCursor: typeof response.nextCursor === 'string' && response.nextCursor ? response.nextCursor : null,
        status: 'ready',
        ratings,
      }
    })
  } catch {
    update(userId, characterId, room => ({ ...room, status: room.messages.length ? 'ready' : 'error' }))
  }
}

// ── 40 · 41 ───────────────────────────────────────────────────────────────────────────────────

/** 40: the same choice again cancels it (null); the other replaces it. */
export function nextRating(current: ReplyRating, chosen: 'UP' | 'DOWN'): ReplyRating {
  return current === chosen ? null : chosen
}

export function setReplyRating(userId: number, characterId: string, requestId: string, rating: ReplyRating) {
  update(userId, characterId, room => ({ ...room, ratings: { ...room.ratings, [requestId]: rating } }))
}
export function markReplyReported(userId: number, characterId: string, requestId: string) {
  update(userId, characterId, room => ({ ...room, reported: new Set([...room.reported, requestId]) }))
}

export const REPORT_REASONS = [
  { value: 'INAPPROPRIATE', label: '부적절한 내용' },
  { value: 'VIOLENT', label: '폭력적이거나 위협적인 내용' },
  { value: 'OUT_OF_CHARACTER', label: '캐릭터와 맞지 않는 말' },
  { value: 'OTHER', label: '기타' },
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]['value']
export const REPORT_DETAIL_MAX = 300

/** 41 body, or the message to show: a reason is required; `OTHER` needs a detail of 1–300 characters. */
export function reportRequest(reason: ReportReason | null, detail: string):
  | { ok: true; body: { reason: ReportReason; detail?: string } }
  | { ok: false; message: string } {
  if (!reason) return { ok: false, message: '신고 사유를 골라 주세요.' }
  const text = detail.trim()
  if (text.length > REPORT_DETAIL_MAX) return { ok: false, message: `${REPORT_DETAIL_MAX}자 이하로 적어 주세요.` }
  if (reason === 'OTHER' && !text) return { ok: false, message: '기타 사유를 적어 주세요.' }
  return { ok: true, body: { reason, ...(text ? { detail: text } : {}) } }
}
