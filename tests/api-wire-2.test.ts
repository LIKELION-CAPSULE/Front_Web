import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/shared/api/client.ts'
import type { ChatMessage, ChatRoomResponse, NotificationList } from '../src/shared/api/types.ts'
import type { Message } from '../src/features/demo/types.ts'
import {
  appendOlderPage, chatMessage, chatRoomSnapshot, forgetAllChatRooms, forgetChatRoom, loadChatRoom, markReplyReported, mergeChatHistory,
  nextRating, REPORT_DETAIL_MAX, REPORT_REASONS, reportRequest, setReplyRating,
} from '../src/features/mates/chat-room.ts'
import { appendNotifications, inAppLink, markRead, notificationPage, relativeTime, unreadIds, UNREAD_REFRESH_MS } from '../src/features/notifications/notifications.ts'
import { CREDIT_NOTICE_COPY, creditShortage, shouldNoteVoiceFallback, VOICE_REPLIES_REQUESTED } from '../src/features/mates/credit-notice.ts'

// Examples built from docs/BACKEND_API.md (11-25) 32 · 40 · 41 · 43 · 44 tables.

const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 1, minute)).toISOString()
const turn = (requestId: string, minute: number, connectionId = 77, rating: ChatMessage['rating'] = null): ChatMessage[] => [
  { requestId, sender: 'MATE', content: `답장 ${requestId}`, inputType: null, rating, createdAt: at(minute), connectionId },
  { requestId, sender: 'USER', content: `질문 ${requestId}`, inputType: 'TEXT', rating: null, createdAt: at(minute), connectionId },
]

// ── 32 ──

test('32 messages become the app messages with the same ids as this browser’s lines; malformed ones fail with 502', () => {
  const [reply, user] = turn('r1', 0, 77, 'UP').map(item => chatMessage(item, '4'))
  assert.equal(user!.id, 'r1:user'); assert.equal(reply!.id, 'r1:reply')
  assert.equal(reply!.sessionId, '77'); assert.equal(reply!.delivery, 'confirmed'); assert.equal(reply!.rating, 'UP')
  assert.equal(user!.rating, null)
  for (const bad of [null, { ...turn('x', 0)[0], requestId: '' }, { ...turn('x', 0)[0], sender: 'BOT' }, { ...turn('x', 0)[0], createdAt: 'nope' }, { ...turn('x', 0)[0], connectionId: 0 }]) {
    assert.throws(() => chatMessage(bad as ChatMessage, '4'), { status: 502 })
  }
})

test('32 merge: each line once (by requestId and sender), oldest first, the question before its reply', () => {
  const history = [...turn('r2', 2), ...turn('r1', 1)].map(item => chatMessage(item, '4'))
  const local: Message[] = [
    // The running connection (77): r2 also in the history (this browser's copy wins), r3 not listed yet.
    { id: 'r2:user', requestId: 'r2', sessionId: '77', characterId: '4', sender: 'user', text: '질문 r2', voice: false, createdAt: Date.parse(at(2)), delivery: 'confirmed' },
    { id: 'r2:reply', requestId: 'r2', sessionId: '77', characterId: '4', sender: 'character', text: '답장 r2 (local)', voice: false, createdAt: Date.parse(at(2)), delivery: 'confirmed' },
    { id: 'r3:user', requestId: 'r3', sessionId: '77', characterId: '4', sender: 'user', text: '질문 r3', voice: false, createdAt: Date.parse(at(3)), delivery: 'pending' },
    // An earlier connection's line the server leaves out (e.g. reported, or before a reset): stays out.
    { id: 'old:reply', requestId: 'old', sessionId: '50', characterId: '4', sender: 'character', text: '지운 답장', voice: false, createdAt: Date.parse(at(0)), delivery: 'confirmed' },
  ]
  const merged = mergeChatHistory(history, local, '77', true)
  assert.deepEqual(merged.map(message => message.id), ['r1:user', 'r1:reply', 'r2:user', 'r2:reply', 'r3:user'])
  assert.equal(merged.find(message => message.id === 'r2:reply')!.text, '답장 r2 (local)')
  assert.equal(new Set(merged.map(message => message.id)).size, merged.length)
  // Before the history is read (or when it failed): this browser's lines, as before.
  assert.deepEqual(mergeChatHistory([], local, '77', false).map(message => message.id), ['old:reply', 'r2:user', 'r2:reply', 'r3:user'])
  // No connection running: only the server's history.
  assert.deepEqual(mergeChatHistory(history, local, null, true).map(message => message.id), ['r1:user', 'r1:reply', 'r2:user', 'r2:reply'])
})

test('32 older pages go above what is loaded, without repeating a line', () => {
  const first = [...turn('r3', 3), ...turn('r2', 2)].map(item => chatMessage(item, '4'))
  const older = [...turn('r2', 2), ...turn('r1', 1)].map(item => chatMessage(item, '4'))
  const all = appendOlderPage(appendOlderPage([], first), older)
  assert.deepEqual(all.map(message => message.id), ['r1:user', 'r1:reply', 'r2:user', 'r2:reply', 'r3:user', 'r3:reply'])
})

test('32 paging with cursor: first page, then nextCursor, stops at the end; ratings seed from 32; a failed first read is an error', async () => {
  forgetAllChatRooms()
  const pages: Record<string, ChatRoomResponse> = {
    first: { messages: [...turn('r3', 3, 77, 'DOWN'), ...turn('r2', 2)], nextCursor: 'c2' },
    c2: { messages: turn('r1', 1, 70, 'UP'), nextCursor: null },
  }
  const cursors: (string | null)[] = []
  const read = async (cursor: string | null) => { cursors.push(cursor); return pages[cursor ?? 'first']! }
  await loadChatRoom(1, '4', read)
  let room = chatRoomSnapshot(1, '4')
  assert.equal(room.status, 'ready'); assert.equal(room.nextCursor, 'c2'); assert.equal(room.messages.length, 4)
  assert.equal(room.ratings.r3, 'DOWN')
  await loadChatRoom(1, '4', read)
  room = chatRoomSnapshot(1, '4')
  assert.equal(room.nextCursor, null); assert.equal(room.messages[0]!.id, 'r1:user'); assert.equal(room.ratings.r1, 'UP')
  await loadChatRoom(1, '4', read) // at the end: no request
  assert.deepEqual(cursors, [null, 'c2'])

  // A rating chosen here is not overwritten by an older page; a report folds the reply.
  setReplyRating(1, '4', 'r3', null); markReplyReported(1, '4', 'r2')
  room = chatRoomSnapshot(1, '4')
  assert.equal(room.ratings.r3, null); assert.equal(room.reported.has('r2'), true)

  // 47 reset forgets the room (and the next opening reads it again).
  forgetChatRoom(1, '4')
  assert.equal(chatRoomSnapshot(1, '4').status, 'idle'); assert.equal(chatRoomSnapshot(1, '4').messages.length, 0)

  await loadChatRoom(1, '5', async () => { throw new ApiError('x', 503) })
  assert.equal(chatRoomSnapshot(1, '5').status, 'error')
  await loadChatRoom(1, '6', async () => ({ messages: [{ requestId: 'bad' }] }) as ChatRoomResponse)
  assert.equal(chatRoomSnapshot(1, '6').status, 'error')
  forgetAllChatRooms()
})

// ── 40 · 41 ──

test('40: a thumb toggles; the same one again cancels (null), the other replaces it', () => {
  assert.equal(nextRating(null, 'UP'), 'UP')
  assert.equal(nextRating('UP', 'UP'), null)
  assert.equal(nextRating('UP', 'DOWN'), 'DOWN')
  assert.equal(nextRating('DOWN', 'DOWN'), null)
})

test('41: four reasons; OTHER needs a detail of 1–300 characters; the body only carries a detail when there is one', () => {
  assert.deepEqual(REPORT_REASONS.map(reason => reason.value), ['INAPPROPRIATE', 'VIOLENT', 'OUT_OF_CHARACTER', 'OTHER'])
  assert.deepEqual(reportRequest(null, ''), { ok: false, message: '신고 사유를 골라 주세요.' })
  assert.deepEqual(reportRequest('OTHER', '   '), { ok: false, message: '기타 사유를 적어 주세요.' })
  assert.deepEqual(reportRequest('OTHER', 'x'.repeat(REPORT_DETAIL_MAX + 1)), { ok: false, message: '300자 이하로 적어 주세요.' })
  assert.deepEqual(reportRequest('OTHER', ` ${'x'.repeat(REPORT_DETAIL_MAX)} `), { ok: true, body: { reason: 'OTHER', detail: 'x'.repeat(REPORT_DETAIL_MAX) } })
  assert.deepEqual(reportRequest('VIOLENT', ''), { ok: true, body: { reason: 'VIOLENT' } })
  assert.deepEqual(reportRequest('INAPPROPRIATE', ' 메모 '), { ok: true, body: { reason: 'INAPPROPRIATE', detail: '메모' } })
})

// ── 43 · 44 ──

const notificationExample: NotificationList = {
  items: [
    { id: 30, type: 'STAGE_UP', title: '채린과 한 걸음 가까워졌어요', body: '새 표정이 열렸어요.', link: '/mates/me', read: false, createdAt: at(30) },
    { id: 29, type: 'ATTENDANCE', title: '출석 보상', body: null, link: '/credits', read: true, createdAt: at(20) },
    { id: 28, type: 'REFERRAL_REWARD', title: '초대 보상', body: '  ', link: 'https://evil.example/x', read: false, createdAt: at(10) },
  ],
  unreadCount: 5,
  nextBefore: 28,
}

test('43 page: items checked, outside links dropped, nextBefore kept; malformed responses fail with 502', () => {
  const page = notificationPage(notificationExample)
  assert.equal(page.unreadCount, 5); assert.equal(page.nextBefore, 28)
  assert.deepEqual(page.items.map(item => item.link), ['/mates/me', '/credits', null])
  assert.equal(page.items[2]!.body, null)
  assert.equal(notificationPage({ items: [], unreadCount: 0, nextBefore: null }).nextBefore, null)
  for (const bad of [null, { items: [] }, { items: [], unreadCount: -1 }, { items: [{ id: 1, title: '', read: false, createdAt: at(0) }], unreadCount: 0 }, { items: [{ id: 1, title: 'a', read: 'no', createdAt: at(0) }], unreadCount: 0 }]) {
    assert.throws(() => notificationPage(bad as NotificationList), { status: 502 })
  }
})

test('43 links: only in-app paths; the old invite paths open the current one', () => {
  assert.equal(inAppLink('/mates/me'), '/mates/me')
  assert.equal(inAppLink('/records?period=week#top'), '/records?period=week#top')
  assert.equal(inAppLink('/credits/charge'), '/credits/invite')
  assert.equal(inAppLink('/invite'), '/credits/invite')
  for (const outside of ['https://example.com', '//example.com/a', '/\\example.com', 'javascript:alert(1)', 'mates/me', '', null, 3]) assert.equal(inAppLink(outside), null)
})

test('43 append (nextBefore pages) and 44 read: newest first, each once; ids or all; unread ids are what opening marks', () => {
  const first = notificationPage(notificationExample).items
  const older = notificationPage({ items: [
    { id: 28, type: 'REFERRAL_REWARD', title: '초대 보상', body: null, link: null, read: false, createdAt: at(10) },
    { id: 27, type: 'ATTENDANCE', title: '출석 보상', body: null, link: '/credits', read: false, createdAt: at(5) },
  ], unreadCount: 5, nextBefore: null }).items
  const all = appendNotifications(first, older)
  assert.deepEqual(all.map(item => item.id), [30, 29, 28, 27])
  assert.deepEqual(unreadIds(all), [30, 28, 27])
  const someRead = markRead(all, [30, 28])
  assert.deepEqual(unreadIds(someRead), [27])
  assert.deepEqual(unreadIds(markRead(all)), [])
  assert.equal(markRead(all, [])[0], all[0]) // nothing to change keeps the item
})

test('43 times are relative, then the Seoul date; the unread count refreshes at most every five minutes', () => {
  const now = Date.parse('2026-11-25T03:00:00Z')
  assert.equal(relativeTime(now - 20_000, now), '방금 전')
  assert.equal(relativeTime(now - 5 * 60_000, now), '5분 전')
  assert.equal(relativeTime(now - 3 * 3_600_000, now), '3시간 전')
  assert.equal(relativeTime(now - 30 * 3_600_000, now), '어제')
  assert.equal(relativeTime(now - 4 * 86_400_000, now), '4일 전')
  assert.equal(relativeTime(Date.parse('2026-11-01T16:00:00Z'), now), '11월 2일')
  assert.equal(relativeTime(now + 60_000, now), '방금 전')
  assert.ok(UNREAD_REFRESH_MS >= 5 * 60 * 1000)
})

// ── Credits ──

test('409 CREDIT_INSUFFICIENT: the notice with the remaining credits (number or todayRemaining); other errors are not it', () => {
  assert.deepEqual(creditShortage(new ApiError('x', 409, 'CREDIT_INSUFFICIENT', { credits: { todayRemaining: 10 } })), { credits: 10 })
  assert.deepEqual(creditShortage(new ApiError('x', 409, 'CREDIT_INSUFFICIENT', { credits: 4 })), { credits: 4 })
  assert.deepEqual(creditShortage(new ApiError('x', 409, 'CREDIT_INSUFFICIENT')), { credits: null })
  assert.equal(creditShortage(new ApiError('x', 409, 'CONNECTION_ENDED')), null)
  assert.equal(creditShortage(new Error('CREDIT_INSUFFICIENT')), null)
  assert.equal(CREDIT_NOTICE_COPY.title, '크레딧이 부족해요')
  assert.equal(CREDIT_NOTICE_COPY.basic, '기본 모드로 계속')
  assert.equal(CREDIT_NOTICE_COPY.invite, '친구 초대로 받기')
})

test('done.voice false: a short note once, and only when a voice reply was asked for (not yet: tts is off)', () => {
  assert.equal(VOICE_REPLIES_REQUESTED, false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: VOICE_REPLIES_REQUESTED, voice: false, noted: false }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: false, noted: false }), true)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: false, noted: true }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: true, noted: false }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: undefined, noted: false }), false)
})
