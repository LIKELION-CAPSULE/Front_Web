import assert from 'node:assert/strict'
import test from 'node:test'
import { LONG_LINE, UNREAD_LINE, letterPace, subtitlePages } from '../src/features/review/call-ui/script.ts'

const squash = (text: string) => text.replace(/\s+/g, '')

test('call-ui draft: subtitle pages keep every letter (… included) and stay within the page size', () => {
  for (const max of [20, 36, 46, 92]) {
    const pages = subtitlePages(LONG_LINE, max)
    assert.equal(squash(pages.join('')), squash(LONG_LINE))
    for (const page of pages) assert.ok(Array.from(page).length <= max, `${max}: ${page}`)
  }
  assert.ok(subtitlePages(LONG_LINE, 46).join(' ').includes('…칭찬'))
})

test('call-ui draft: a short line is one page; a long one turns pages', () => {
  assert.deepEqual(subtitlePages(UNREAD_LINE, 92), [UNREAD_LINE])
  assert.ok(subtitlePages(LONG_LINE, 46).length >= 3)
})

test('call-ui draft: subtitle letters type at the chat pace (TypingMessage: 15–32 ms, 2.5 s a line)', () => {
  assert.equal(letterPace('가'.repeat(50)), 32)
  assert.equal(letterPace('가'.repeat(125)), 20)
  assert.equal(letterPace('가'.repeat(400)), 15)
})
