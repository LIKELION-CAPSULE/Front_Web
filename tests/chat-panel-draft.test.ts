import assert from 'node:assert/strict'
import test from 'node:test'
import { DRAFT_NOW, chatBlocks, clock, dayWord, dividerLabel, draftHistory, type DraftLine } from '../src/features/review/chat-panel/script.ts'

const minute = 60_000
const line = (id: string, sender: DraftLine['sender'], offset: number, system?: DraftLine['system']): DraftLine =>
  ({ id, sender, text: id, at: DRAFT_NOW + offset * minute, ...(system ? { system } : {}) })

test('chat panel draft: the divider reads 「오늘 23:39」, 「어제 22:10」, then a date', () => {
  assert.equal(dividerLabel(DRAFT_NOW), '오늘 23:39')
  assert.equal(dividerLabel(DRAFT_NOW - (24 * 60 + 89) * minute), '어제 22:10')
  assert.equal(dayWord(DRAFT_NOW - 2 * 24 * 60 * minute), '11월 25일')
  assert.equal(clock(DRAFT_NOW + 21 * minute), '00:00')
  assert.equal(dayWord(DRAFT_NOW + 21 * minute), '11월 28일')
})

test('chat panel draft: runs of one side within 3 minutes; a system line ends the run (or is left out)', () => {
  const lines = [line('a', 'mate', 0), line('b', 'mate', 2), line('c', 'mate', 6), line('s', 'system', 6, 'affinity'), line('d', 'mate', 6), line('e', 'user', 7)]
  const shape = (blocks: ReturnType<typeof chatBlocks>) => blocks.map(block => block.kind === 'group' ? `${block.sender}:${block.lines.map(item => item.id).join('')}` : block.kind)
  assert.deepEqual(shape(chatBlocks(lines, { system: true })), ['divider', 'mate:ab', 'mate:c', 'system', 'mate:d', 'user:e'])
  assert.deepEqual(shape(chatBlocks(lines, { system: false })), ['divider', 'mate:ab', 'mate:cd', 'user:e'])
})

test('chat panel draft: a new divider after 30 quiet minutes or a new day', () => {
  const lines = [line('a', 'user', -40), line('b', 'mate', -10), line('c', 'user', 25)]
  assert.deepEqual(chatBlocks(lines, { system: false }).filter(block => block.kind === 'divider').map(block => dividerLabel(block.at)), ['오늘 22:59', '오늘 23:29', '11월 28일 00:04'])
})

test('chat panel draft: three states (empty, a few, a long log over two days)', () => {
  assert.equal(draftHistory('empty').length, 0)
  const few = draftHistory('few')
  const long = draftHistory('long')
  assert.ok(few.length >= 6 && few.length < 12)
  assert.ok(long.length >= 25)
  assert.deepEqual(chatBlocks(long, { system: false }).filter(block => block.kind === 'divider').map(block => dividerLabel(block.at)), ['어제 22:10', '오늘 23:39'])
  // Times run forward, so the runs and dividers read in order.
  assert.ok(long.every((item, index) => index === 0 || item.at >= long[index - 1]!.at))
})
