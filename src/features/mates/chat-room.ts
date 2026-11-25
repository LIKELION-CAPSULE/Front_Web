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
  /** The server's history as last read successfully (every page so far), oldest first. */
  messages: readonly Message[]
  /** The next older page; null at the start of the conversation (or before the first read). */
  nextCursor: string | null
  /** A read has succeeded at least once (`messages` is the server's word, not just an empty start). */
  loaded: boolean
  /** Client time the last successful latest-page read was sent: this browser's lines from then on are newer than it. */
  readAt: number
  /** Reads on their way: the latest page (first read, or a refresh) and an older page. */
  loading: { latest: boolean; older: boolean }
  /** The last read of that kind failed (cleared by the next attempt); 「다시 시도」 retries it. */
  failed: 'latest' | 'older' | null
  ratings: Readonly<Record<string, ReplyRating>>
  /** Replies this browser reported (folded until the next read leaves them out). */
  reported: ReadonlySet<string>
}

const empty: ChatRoomState = {
  messages: [], nextCursor: null, loaded: false, readAt: 0, loading: { latest: false, older: false }, failed: null, ratings: {}, reported: new Set(),
}
const rooms = new Map<string, ChatRoomState>()
const listeners = new Set<() => void>()
const roomKey = (userId: number | string, characterId: string) => `${userId}:${characterId}`
/**
 * Request generations: a read answers only into the generation it was sent in. 47 reset (`forgetChatRoom`) moves
 * that mate's generation on; sign-out (`forgetAllChatRooms`) moves every one on. A late answer — success or failure —
 * of an older generation is dropped, so it cannot bring back what was forgotten.
 */
const generations = new Map<string, number>()
let epoch = 0
const generation = (key: string) => `${epoch}:${generations.get(key) ?? 0}`
/** Changes when this room is forgotten (47, sign-out): a reason to read it again. */
export const chatRoomGeneration = (userId: number | string | undefined, characterId: string | undefined) =>
  userId !== undefined && characterId ? generation(roomKey(userId, characterId)) : ''
/** A refresh asked for while one is on its way runs again when that one is done (with the newest state). */
const againLatest = new Set<string>()
/** Older pages belong to one run of loaded history; a refresh that had to start over moves this on. */
const windows = new Map<string, number>()

export function chatRoomSnapshot(userId: number | string | undefined, characterId: string | undefined): ChatRoomState {
  return userId !== undefined && characterId ? rooms.get(roomKey(userId, characterId)) ?? empty : empty
}
export function subscribeChatRooms(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function notify() { for (const listener of listeners) listener() }
function update(userId: number | string, characterId: string, change: (room: ChatRoomState) => ChatRoomState) {
  const key = roomKey(userId, characterId)
  rooms.set(key, change(rooms.get(key) ?? empty))
  notify()
}

/** 47 reset: this mate's room is read again from the start, and reads already on their way are dropped. */
export function forgetChatRoom(userId: number | string, characterId: string) {
  const key = roomKey(userId, characterId)
  generations.set(key, (generations.get(key) ?? 0) + 1)
  againLatest.delete(key)
  rooms.delete(key)
  notify()
}
/** Sign-out (or another account): every room, and every read on its way. */
export function forgetAllChatRooms() {
  epoch++
  againLatest.clear()
  rooms.clear()
  notify()
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
 * The panel's list: the server's history, plus this browser's lines the server could not have listed yet — the running
 * connection's, lines still on their way, and lines from after the last read (a connection that just ended or changed,
 * until the refresh answers). A line in both keeps this browser's copy (its id keeps the typing state of a reply on
 * screen). Older lines the server leaves out stay out. Oldest first. Before any read has succeeded, this browser's
 * lines as before.
 */
export function mergeChatHistory(
  history: readonly Message[],
  local: readonly Message[],
  activeConnectionId: string | null,
  historyLoaded: boolean,
  readAt = Number.POSITIVE_INFINITY,
): Message[] {
  if (!historyLoaded) return [...local].sort(order)
  const localById = new Map(local.map(message => [message.id, message]))
  const result = history.map(message => localById.get(message.id) ?? message)
  const listed = new Set(history.map(message => message.id))
  for (const message of local) {
    if (listed.has(message.id)) continue
    const unseen = (activeConnectionId !== null && message.sessionId === activeConnectionId) || message.delivery === 'pending' ||
      (message.createdAt ?? 0) >= readAt
    if (unseen) result.push(message)
  }
  return result.sort(order)
}

/** Adds an older page (32 `messages`, newest first) to what is loaded; a line already loaded is not added twice. */
export function appendOlderPage(loaded: readonly Message[], page: readonly Message[]): Message[] {
  const ids = new Set(loaded.map(message => message.id))
  return [...page.filter(message => !ids.has(message.id)), ...loaded].sort(order)
}

/**
 * A fresh latest page over what is loaded. Where the page reaches back into the loaded lines, the page replaces that
 * stretch (the server's word: new lines in, left-out lines out) and the older pages already loaded stay with their
 * cursor. Where it does not (more new lines than a page), it starts over from the page.
 */
export function mergeLatestPage(
  loaded: { messages: readonly Message[]; nextCursor: string | null; loaded: boolean },
  page: readonly Message[],
  pageCursor: string | null,
): { messages: Message[]; nextCursor: string | null; restarted: boolean } {
  const fresh = appendOlderPage([], page)
  if (!loaded.loaded || pageCursor === null || !fresh.length || !loaded.messages.length) return { messages: fresh, nextCursor: pageCursor, restarted: true }
  const pageStart = fresh[0]!.createdAt ?? 0
  const pageIds = new Set(fresh.map(message => message.id))
  const newestLoaded = loaded.messages.at(-1)!.createdAt ?? 0
  // A gap between the loaded lines and the page: what lies between is unknown, so start over.
  if (newestLoaded < pageStart) return { messages: fresh, nextCursor: pageCursor, restarted: true }
  const before = loaded.messages.filter(message => (message.createdAt ?? 0) < pageStart || ((message.createdAt ?? 0) === pageStart && !pageIds.has(message.id)))
  if (!before.length) return { messages: fresh, nextCursor: pageCursor, restarted: true }
  return { messages: [...before, ...fresh].sort(order), nextCursor: loaded.nextCursor, restarted: false }
}

type Read = (cursor: string | null) => Promise<ChatRoomResponse>

function pageOf(response: ChatRoomResponse, characterId: string) {
  if (!response || !Array.isArray(response.messages)) throw new ApiError('대화 기록 응답을 확인하지 못했어요.', 502)
  return {
    page: response.messages.map(item => chatMessage(item, characterId)),
    cursor: typeof response.nextCursor === 'string' && response.nextCursor ? response.nextCursor : null,
  }
}
function seedRatings(ratings: Readonly<Record<string, ReplyRating>>, page: readonly (Message & { rating: ReplyRating })[]) {
  const next = { ...ratings }
  for (const message of page) if (message.sender === 'character' && message.requestId && !(message.requestId in next)) next[message.requestId] = message.rating
  return next
}

/**
 * Reads the latest page: the first read, or a refresh (the panel opened again, the connection changed or ended,
 * 「다시 시도」). What is loaded stays on screen meanwhile. Asked again while one is on its way, it runs once more after.
 */
export async function loadLatestChat(userId: number, characterId: string, read: Read): Promise<void> {
  const key = roomKey(userId, characterId)
  if (chatRoomSnapshot(userId, characterId).loading.latest) { againLatest.add(key); return }
  const sentIn = generation(key)
  const sentAt = Date.now()
  update(userId, characterId, room => ({ ...room, loading: { ...room.loading, latest: true }, failed: room.failed === 'latest' ? null : room.failed }))
  let outcome: { page: (Message & { rating: ReplyRating })[]; cursor: string | null } | null = null
  try {
    outcome = pageOf(await read(null), characterId)
  } catch { /* Handled below, in its generation. */ }
  if (generation(key) !== sentIn) return
  update(userId, characterId, room => {
    const loading = { ...room.loading, latest: false }
    if (!outcome) return { ...room, loading, failed: 'latest' }
    const merged = mergeLatestPage(room, outcome.page, outcome.cursor)
    if (merged.restarted) windows.set(key, (windows.get(key) ?? 0) + 1)
    return { ...room, loading, failed: null, loaded: true, readAt: sentAt, messages: merged.messages, nextCursor: merged.nextCursor, ratings: seedRatings(room.ratings, outcome.page) }
  })
  if (againLatest.delete(key)) await loadLatestChat(userId, characterId, read)
}

/** Reads the next older page (scrolled to the top, or 「다시 시도」). Ignored before the first read, at the start, or while one is on its way. */
export async function loadOlderChat(userId: number, characterId: string, read: Read): Promise<boolean> {
  const key = roomKey(userId, characterId)
  const current = chatRoomSnapshot(userId, characterId)
  if (!current.loaded || current.nextCursor === null || current.loading.older) return false
  const sentIn = generation(key)
  const window = windows.get(key) ?? 0
  update(userId, characterId, room => ({ ...room, loading: { ...room.loading, older: true }, failed: room.failed === 'older' ? null : room.failed }))
  let outcome: { page: (Message & { rating: ReplyRating })[]; cursor: string | null } | null = null
  try {
    outcome = pageOf(await read(current.nextCursor), characterId)
  } catch { /* Handled below, in its generation. */ }
  if (generation(key) !== sentIn) return false
  const sameWindow = (windows.get(key) ?? 0) === window
  update(userId, characterId, room => {
    const loading = { ...room.loading, older: false }
    if (!outcome) return { ...room, loading, failed: 'older' }
    // A refresh started over meanwhile: this page belonged to the history before it.
    if (!sameWindow) return { ...room, loading }
    return { ...room, loading, messages: appendOlderPage(room.messages, outcome.page), nextCursor: outcome.cursor, ratings: seedRatings(room.ratings, outcome.page) }
  })
  return Boolean(outcome) && sameWindow
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
