import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/shared/api/client.ts'
import type { ChatMessage, ChatRoomResponse, NotificationList } from '../src/shared/api/types.ts'
import type { Message } from '../src/features/demo/types.ts'
import {
  appendOlderPage, chatMessage, chatRoomSnapshot, forgetAllChatRooms, forgetChatRoom, loadLatestChat, loadOlderChat, markReplyReported, mergeChatHistory, mergeLatestPage,
  nextRating, REPORT_DETAIL_MAX, REPORT_REASONS, reportRequest, setReplyRating,
} from '../src/features/mates/chat-room.ts'
import { appendNotifications, inAppLink, markRead, notificationPage, relativeTime, unreadIds, UNREAD_REFRESH_MS } from '../src/features/notifications/notifications.ts'
import { CREDIT_NOTICE_COPY, creditShortage, shouldNoteVoiceFallback } from '../src/features/mates/credit-notice.ts'

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
  // No connection running: the server's history, and a line still on its way (r3, pending).
  assert.deepEqual(mergeChatHistory(history, local, null, true).map(message => message.id), ['r1:user', 'r1:reply', 'r2:user', 'r2:reply', 'r3:user'])
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
  await loadLatestChat(1, '4', read)
  let room = chatRoomSnapshot(1, '4')
  assert.equal(room.loaded, true); assert.equal(room.nextCursor, 'c2'); assert.equal(room.messages.length, 4)
  assert.equal(room.ratings.r3, 'DOWN')
  assert.equal(await loadOlderChat(1, '4', read), true)
  room = chatRoomSnapshot(1, '4')
  assert.equal(room.nextCursor, null); assert.equal(room.messages[0]!.id, 'r1:user'); assert.equal(room.ratings.r1, 'UP')
  assert.equal(await loadOlderChat(1, '4', read), false) // at the end: no request
  assert.deepEqual(cursors, [null, 'c2'])

  // A rating chosen here is not overwritten by an older page; a report folds the reply.
  setReplyRating(1, '4', 'r3', null); markReplyReported(1, '4', 'r2')
  room = chatRoomSnapshot(1, '4')
  assert.equal(room.ratings.r3, null); assert.equal(room.reported.has('r2'), true)

  // 47 reset forgets the room (and the next opening reads it again).
  forgetChatRoom(1, '4')
  assert.equal(chatRoomSnapshot(1, '4').loaded, false); assert.equal(chatRoomSnapshot(1, '4').messages.length, 0)

  await loadLatestChat(1, '5', async () => { throw new ApiError('x', 503) })
  assert.equal(chatRoomSnapshot(1, '5').failed, 'latest'); assert.equal(chatRoomSnapshot(1, '5').loaded, false)
  await loadLatestChat(1, '6', async () => ({ messages: [{ requestId: 'bad' }] }) as ChatRoomResponse)
  assert.equal(chatRoomSnapshot(1, '6').failed, 'latest')
  forgetAllChatRooms()
})

/** A read the test answers later. */
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

test('[review 1] the latest page is read again (another connection, reopening, retry) and merged; older pages and new lines stay', async () => {
  forgetAllChatRooms()
  // Connection A: the first page (r3 r2), then an older page (r1).
  await loadLatestChat(1, '4', async () => ({ messages: [...turn('r3', 3, 70), ...turn('r2', 2, 70)], nextCursor: 'c2' }))
  await loadOlderChat(1, '4', async () => ({ messages: turn('r1', 1, 70), nextCursor: null }))
  // Connection B starts: the refresh now lists A's last lines (r4 r5) at the top.
  await loadLatestChat(1, '4', async () => ({ messages: [...turn('r5', 5, 70), ...turn('r4', 4, 70)], nextCursor: 'cx' }))
  let room = chatRoomSnapshot(1, '4')
  // r4 and r5 are newer than every loaded line with nothing in between known: start over from the page.
  assert.deepEqual(room.messages.map(message => message.requestId), ['r4', 'r4', 'r5', 'r5'])
  assert.equal(room.nextCursor, 'cx')
  // A refresh that reaches back into what is loaded keeps the older pages and their cursor.
  await loadOlderChat(1, '4', async () => ({ messages: [...turn('r3', 3, 70), ...turn('r2', 2, 70)], nextCursor: 'c2' }))
  await loadLatestChat(1, '4', async () => ({ messages: [...turn('r6', 6, 80), ...turn('r5', 5, 70), ...turn('r4', 4, 70)], nextCursor: 'cy' }))
  room = chatRoomSnapshot(1, '4')
  assert.deepEqual([...new Set(room.messages.map(message => message.requestId))], ['r2', 'r3', 'r4', 'r5', 'r6'])
  assert.equal(room.nextCursor, 'c2')

  // A failed first read is not final: the next request (reopen, connection change, 「다시 시도」) reads again.
  await loadLatestChat(1, '7', async () => { throw new ApiError('x', 503) })
  assert.equal(chatRoomSnapshot(1, '7').failed, 'latest')
  await loadLatestChat(1, '7', async () => ({ messages: turn('q1', 1, 90), nextCursor: null }))
  assert.equal(chatRoomSnapshot(1, '7').failed, null); assert.equal(chatRoomSnapshot(1, '7').messages.length, 2)

  // Asked again while one is on its way: it runs once more after, with the newest answer.
  const first = deferred<ChatRoomResponse>()
  let calls = 0
  const read = () => { calls++; return calls === 1 ? first.promise : Promise.resolve({ messages: turn('q2', 2, 91), nextCursor: null } as ChatRoomResponse) }
  const pending = loadLatestChat(1, '8', read)
  void loadLatestChat(1, '8', read)
  first.resolve({ messages: turn('q1', 1, 91), nextCursor: null })
  await pending
  assert.equal(calls, 2)
  assert.deepEqual(chatRoomSnapshot(1, '8').messages.map(message => message.requestId), ['q2', 'q2'])
  forgetAllChatRooms()
})

test('[review 1] this browser’s lines from after the last read stay until the refresh answers; older left-out lines stay out', () => {
  const history = turn('r1', 1, 70).map(item => chatMessage(item, '4'))
  const readAt = Date.parse(at(2))
  const local: Message[] = [
    { id: 'old:reply', requestId: 'old', sessionId: '60', characterId: '4', sender: 'character', text: '빠진 답장', voice: false, createdAt: Date.parse(at(0)), delivery: 'confirmed' },
    // Connection A just ended (no active connection): its last line is newer than the read.
    { id: 'a1:user', requestId: 'a1', sessionId: '70', characterId: '4', sender: 'user', text: 'A의 마지막 말', voice: false, createdAt: Date.parse(at(3)), delivery: 'confirmed' },
  ]
  assert.deepEqual(mergeChatHistory(history, local, null, true, readAt).map(message => message.id), ['r1:user', 'r1:reply', 'a1:user'])
})

test('[review 2] reading an older page keeps the loaded lines (and the latest reply) on screen', async () => {
  forgetAllChatRooms()
  await loadLatestChat(1, '4', async () => ({ messages: [...turn('r3', 3), ...turn('r2', 2)], nextCursor: 'c2' }))
  const older = deferred<ChatRoomResponse>()
  const pending = loadOlderChat(1, '4', () => older.promise)
  const during = chatRoomSnapshot(1, '4')
  assert.equal(during.loading.older, true); assert.equal(during.loaded, true); assert.equal(during.messages.length, 4)
  const shown = mergeChatHistory(during.messages, [], null, during.loaded, during.readAt)
  assert.equal(shown.findLast(message => message.sender === 'character')!.id, 'r3:reply')
  older.reject(new ApiError('x', 503))
  assert.equal(await pending, false)
  const after = chatRoomSnapshot(1, '4')
  // A failed older page keeps everything and waits for 「다시 시도」.
  assert.equal(after.failed, 'older'); assert.equal(after.messages.length, 4); assert.equal(after.loading.older, false)
  forgetAllChatRooms()
})

test('[review 3] a 32 answer sent before 47 reset or sign-out (success or failure) cannot bring the forgotten room back', async () => {
  forgetAllChatRooms()
  const late = deferred<ChatRoomResponse>()
  const pending = loadLatestChat(1, '4', () => late.promise)
  forgetChatRoom(1, '4') // 47 succeeded meanwhile
  late.resolve({ messages: turn('r1', 1), nextCursor: null })
  await pending
  assert.equal(chatRoomSnapshot(1, '4').loaded, false); assert.equal(chatRoomSnapshot(1, '4').messages.length, 0)

  const failing = deferred<ChatRoomResponse>()
  const failed = loadLatestChat(1, '4', () => failing.promise)
  forgetAllChatRooms() // sign-out
  failing.reject(new ApiError('x', 503))
  await failed
  assert.equal(chatRoomSnapshot(1, '4').failed, null); assert.equal(chatRoomSnapshot(1, '4').loading.latest, false)

  await loadLatestChat(1, '4', async () => ({ messages: turn('r1', 1), nextCursor: 'c2' }))
  const olderLate = deferred<ChatRoomResponse>()
  const olderPending = loadOlderChat(1, '4', () => olderLate.promise)
  forgetChatRoom(1, '4')
  olderLate.resolve({ messages: turn('r0', 0), nextCursor: null })
  assert.equal(await olderPending, false)
  assert.equal(chatRoomSnapshot(1, '4').messages.length, 0)
  // Another mate is not touched by this mate's reset.
  await loadLatestChat(1, '5', async () => ({ messages: turn('m1', 1), nextCursor: null }))
  forgetChatRoom(1, '4')
  assert.equal(chatRoomSnapshot(1, '5').messages.length, 2)
  forgetAllChatRooms()
})

test('32 latest page over loaded lines: replaces the stretch it covers (left-out lines go), keeps what is older', () => {
  const loaded = [...turn('r3', 3), ...turn('r2', 2), ...turn('r1', 1)].map(item => chatMessage(item, '4'))
  const page = [...turn('r4', 4), ...turn('r3', 3), ...turn('r2', 2)].filter(item => !(item.requestId === 'r3' && item.sender === 'MATE')).map(item => chatMessage(item, '4'))
  const merged = mergeLatestPage({ messages: appendOlderPage([], loaded), nextCursor: 'c9', loaded: true }, page, 'cp')
  assert.equal(merged.restarted, false); assert.equal(merged.nextCursor, 'c9')
  // r3's reply was left out by the server (e.g. reported) and goes; r1 r2 stay.
  assert.deepEqual(merged.messages.map(message => message.id), ['r1:user', 'r1:reply', 'r2:user', 'r2:reply', 'r3:user', 'r4:user', 'r4:reply'])
  // The last page (no cursor) is the whole conversation.
  assert.equal(mergeLatestPage({ messages: loaded, nextCursor: 'c9', loaded: true }, page, null).restarted, true)
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

test('done.voice false: a short note once, and only when a voice reply was asked for', () => {
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: false, voice: false, noted: false }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: false, noted: false }), true)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: false, noted: true }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: true, noted: false }), false)
  assert.equal(shouldNoteVoiceFallback({ requestedVoice: true, voice: undefined, noted: false }), false)
})
