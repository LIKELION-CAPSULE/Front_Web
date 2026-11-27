import assert from 'node:assert/strict'
import test from 'node:test'
import { CHAT_GROUP_GAP_MS, groupChatLines, unreadArrivals } from '../src/features/mates/chat-groups.ts'

const line = (id: string, sender: 'user' | 'character', createdAt?: number) => ({ id, sender, createdAt })

test('chat groups: consecutive lines of one side form one group, the other side starts a new one', () => {
  const groups = groupChatLines([line('a', 'character', 0), line('b', 'character', 1000), line('c', 'user', 2000), line('d', 'user', 3000), line('e', 'character', 4000)])
  assert.deepEqual(groups.map(group => [group.key, group.sender, group.lines.map(value => value.id).join('')]), [
    ['a', 'character', 'ab'], ['c', 'user', 'cd'], ['e', 'character', 'e'],
  ])
})

test('chat groups: more than three minutes apart starts a new group; a line without a time stays in the run', () => {
  const groups = groupChatLines([line('a', 'character', 0), line('b', 'character', CHAT_GROUP_GAP_MS + 1), line('c', 'character'), line('d', 'character', CHAT_GROUP_GAP_MS + 2)])
  assert.deepEqual(groups.map(group => group.lines.map(value => value.id).join('')), ['a', 'bcd'])
  assert.equal(groupChatLines([line('a', 'user', 0), line('b', 'user', CHAT_GROUP_GAP_MS)]).length, 1)
})

test('unread: her new lines at the end count only while the reader is scrolled up', () => {
  const before = [line('a', 'user'), line('b', 'character')]
  const after = [...before, line('c', 'user'), line('d', 'character'), line('e', 'character')]
  assert.equal(unreadArrivals(after, 'b', false), 2)
  assert.equal(unreadArrivals(after, 'b', true), 0)
  // Nothing new at the end (an older page landed above, or her line grew while streaming).
  assert.equal(unreadArrivals([line('z', 'character'), ...before], 'b', false), 0)
  // First render, or the history was replaced: only the new last line, if it is hers.
  assert.equal(unreadArrivals(after, undefined, false), 0)
  assert.equal(unreadArrivals([line('x', 'character')], 'gone', false), 1)
  assert.equal(unreadArrivals([line('x', 'user')], 'gone', false), 0)
})

test('timeline: a divider opens the log and comes again after 30 quiet minutes or on a new day', async () => {
  const { chatTimeline } = await import('../src/features/mates/chat-groups.ts')
  const at = (hour: number, minute: number, date = 27) => new Date(2026, 10, date, hour, minute).getTime()
  // 23:01 → 23:50: 49 quiet minutes; 23:50 → 00:05: only 15, but a new day.
  const items = chatTimeline([line('a', 'character', at(23, 0)), line('b', 'user', at(23, 1)), line('c', 'character', at(23, 50)), line('d', 'user', at(0, 5, 28))])
  assert.deepEqual(items.map(item => item.kind === 'group' ? item.lines.map(value => value.id).join('') : item.kind), ['divider', 'a', 'b', 'divider', 'c', 'divider', 'd'])
  // Lines without a time (a reply streaming in) never open a divider.
  assert.deepEqual(chatTimeline([line('x', 'character')]).map(item => item.kind), ['group'])
})

test('timeline: a note goes after the last line not newer than it and ends the run; late notes go last', async () => {
  const { chatTimeline } = await import('../src/features/mates/chat-groups.ts')
  const lines = [line('a', 'character', 1000), line('b', 'character', 2000), line('c', 'character', 4000), line('d', 'character')]
  const shape = (notes: { id: string; at: number }[]) => chatTimeline(lines, notes).map(item => item.kind === 'group' ? item.lines.map(value => value.id).join('') : item.kind === 'note' ? `note:${item.note.id}` : item.kind)
  assert.deepEqual(shape([{ id: 'up', at: 3000 }]), ['divider', 'ab', 'note:up', 'cd'])
  assert.deepEqual(shape([{ id: 'up', at: 9000 }]), ['divider', 'abcd', 'note:up'])
  assert.deepEqual(shape([]), ['divider', 'abcd'])
})

test('timeline: the divider reads 오늘 / 어제 / the date, with a 24-hour clock', async () => {
  const { chatClock, chatDividerLabel } = await import('../src/features/mates/chat-groups.ts')
  const now = new Date(2026, 10, 27, 23, 50).getTime()
  assert.equal(chatDividerLabel(new Date(2026, 10, 27, 23, 39).getTime(), now), '오늘 23:39')
  assert.equal(chatDividerLabel(new Date(2026, 10, 26, 22, 10).getTime(), now), '어제 22:10')
  assert.equal(chatDividerLabel(new Date(2026, 10, 25, 9, 5).getTime(), now), '11월 25일 09:05')
  assert.equal(chatDividerLabel(new Date(2025, 11, 31, 21, 0).getTime(), now), '2025년 12월 31일 21:00')
  assert.equal(chatClock(new Date(2026, 10, 28, 0, 4).getTime()), '00:04')
})
