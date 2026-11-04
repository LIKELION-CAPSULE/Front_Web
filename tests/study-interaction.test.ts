import assert from 'node:assert/strict'
import test from 'node:test'
import { isStudyChatOpen, SELF_STUDY_TILE_ID, selectBreakFriend, selectStudyChatFriend, toggleBreakSelfFocus, toggleStudyChat, toggleStudyFocus } from '../src/features/session/study-interaction.ts'

test('a friend click enlarges the chosen friend and a second click returns to the grid', () => {
  const original = new URLSearchParams('extra=keep')
  const focused = toggleStudyFocus(original, 'chaerin')
  assert.equal(focused.get('focus'), 'chaerin')
  assert.equal(focused.get('chat'), null)
  assert.equal(toggleStudyFocus(focused, 'chaerin').toString(), 'extra=keep')
  assert.equal(original.toString(), 'extra=keep')
})

test('a chat friend tab selects a conversation without changing a normal grid', () => {
  const next = selectStudyChatFriend(new URLSearchParams('extra=keep'), 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('friend'), 'sua')
  assert.equal(next.get('focus'), null)
  assert.equal(next.get('extra'), 'keep')
  assert.equal(selectStudyChatFriend(next, 'sua').get('chat'), '1')
})

test('changing a chat friend preserves the enlarged view', () => {
  const next = selectStudyChatFriend(new URLSearchParams('focus=chaerin&extra=keep'), 'sua')
  assert.equal(next.get('focus'), 'chaerin')
  assert.equal(next.get('friend'), 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('extra'), 'keep')
})

test('enlarging a friend keeps the existing chat and conversation partner', () => {
  const next = toggleStudyFocus(new URLSearchParams('chat=1&friend=chaerin&focus=chaerin'), 'sua')
  assert.equal(next.get('focus'), 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('friend'), 'chaerin')
})

test('my tile enlarges and switches with friends without changing the conversation', () => {
  const original = new URLSearchParams('chat=1&friend=sua&focus=chaerin&extra=keep')
  const mine = toggleStudyFocus(original, SELF_STUDY_TILE_ID)
  assert.equal(mine.get('focus'), 'self')
  assert.equal(mine.get('friend'), 'sua')
  assert.equal(mine.get('chat'), '1')
  const chat = selectStudyChatFriend(mine, 'dahee')
  assert.equal(chat.get('focus'), 'self')
  assert.equal(chat.get('friend'), 'dahee')
  assert.equal(toggleStudyFocus(chat, SELF_STUDY_TILE_ID).has('focus'), false)
  assert.equal(toggleStudyFocus(mine, 'chaerin').get('focus'), 'chaerin')
  assert.equal(original.toString(), 'chat=1&friend=sua&focus=chaerin&extra=keep')
})

test('my break preview toggles without opening chat or losing the previous main friend', () => {
  const original = new URLSearchParams('focus=sua&chat=0&extra=keep')
  const mine = toggleBreakSelfFocus(original, 'sua')
  assert.equal(mine.get('focus'), 'self')
  assert.equal(mine.get('friend'), 'sua')
  assert.equal(mine.get('chat'), '0')
  const restored = toggleBreakSelfFocus(mine, 'sua')
  assert.equal(restored.has('focus'), false)
  assert.equal(restored.get('friend'), 'sua')
  assert.equal(restored.get('chat'), '0')
  assert.equal(restored.get('extra'), 'keep')
  assert.equal(original.toString(), 'focus=sua&chat=0&extra=keep')
})

test('a break friend thumbnail replaces my expanded view and keeps the shared conversation flow', () => {
  const original = new URLSearchParams('focus=self&friend=sua&chat=0&extra=keep')
  const next = selectBreakFriend(original, 'dahee')
  assert.equal(next.has('focus'), false)
  assert.equal(next.get('friend'), 'dahee')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('extra'), 'keep')
  assert.equal(original.get('focus'), 'self')
})

test('the chat control toggles both ways without changing layout or losing its friend', () => {
  const original = new URLSearchParams('focus=chaerin&extra=keep')
  const opened = toggleStudyChat(original, 'sua')
  assert.equal(isStudyChatOpen(original), false)
  assert.equal(isStudyChatOpen(opened), true)
  assert.equal(opened.get('friend'), 'sua')
  assert.equal(opened.get('focus'), 'chaerin')
  const closed = toggleStudyChat(opened, 'chaerin')
  assert.equal(isStudyChatOpen(closed), false)
  assert.equal(closed.get('friend'), 'sua')
  assert.equal(closed.get('focus'), 'chaerin')
  assert.equal(closed.get('extra'), 'keep')
  assert.equal(original.toString(), 'focus=chaerin&extra=keep')
})

test('the chat control can close and reopen the automatically opened break conversation', () => {
  const original = new URLSearchParams('friend=sua')
  assert.equal(isStudyChatOpen(original, true), true)
  assert.equal(isStudyChatOpen(original), false)
  const closed = toggleStudyChat(original, 'sua', true)
  assert.equal(closed.get('chat'), '0')
  assert.equal(isStudyChatOpen(closed, true), false)
  const opened = toggleStudyChat(closed, 'sua', true)
  assert.equal(isStudyChatOpen(opened, true), true)
  assert.equal(opened.get('friend'), 'sua')
  assert.equal(original.has('chat'), false)
})
