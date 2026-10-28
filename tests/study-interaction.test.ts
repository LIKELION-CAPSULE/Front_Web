import assert from 'node:assert/strict'
import test from 'node:test'
import { activateStudyFriend } from '../src/features/session/study-interaction.ts'

test('view mode enlarges the chosen friend and a second activation returns to the grid', () => {
  const original = new URLSearchParams('extra=keep')
  const focused = activateStudyFriend(original, 'focus', 'chaerin')
  assert.equal(focused.get('focus'), 'chaerin')
  assert.equal(focused.get('chat'), null)
  assert.equal(activateStudyFriend(focused, 'focus', 'chaerin').toString(), 'extra=keep')
  assert.equal(original.toString(), 'extra=keep')
})

test('talk mode opens a conversation without changing a normal grid', () => {
  const next = activateStudyFriend(new URLSearchParams('extra=keep'), 'talk', 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('friend'), 'sua')
  assert.equal(next.get('focus'), null)
  assert.equal(next.get('extra'), 'keep')
  assert.equal(activateStudyFriend(next, 'talk', 'sua').get('chat'), '1')
})

test('talking to a small tile selects its sidebar thread and preserves the enlarged view', () => {
  const next = activateStudyFriend(new URLSearchParams('focus=chaerin&extra=keep'), 'talk', 'sua')
  assert.equal(next.get('focus'), 'chaerin')
  assert.equal(next.get('friend'), 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('extra'), 'keep')
})

test('view mode keeps an open conversation when changing the layout', () => {
  const next = activateStudyFriend(new URLSearchParams('chat=1&friend=chaerin&focus=chaerin'), 'focus', 'sua')
  assert.equal(next.get('focus'), 'sua')
  assert.equal(next.get('chat'), '1')
  assert.equal(next.get('friend'), 'chaerin')
})
