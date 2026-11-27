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
