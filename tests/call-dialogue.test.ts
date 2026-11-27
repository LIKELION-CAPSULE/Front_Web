import assert from 'node:assert/strict'
import test from 'node:test'
import { dialogueCapacity, dialogueHold, dialoguePages, letterPace, pickStageLine } from '../src/features/mates/call-dialogue.ts'

const line = (key: string, at: number, text = `${key} 대사`) => ({ key, text, at })

test('call dialogue: the box shows the newest line (reply or event line)', () => {
  assert.equal(pickStageLine([line('reply', 10), line('event:1', 20)], null)?.key, 'event:1')
  assert.equal(pickStageLine([line('reply', 30), line('event:1', 20)], null)?.key, 'reply')
  assert.equal(pickStageLine([null, undefined], null), null)
  // An empty line (a reply before its first letters) is not shown.
  assert.equal(pickStageLine([line('reply', 30, '  '), line('event:1', 20)], null)?.key, 'event:1')
})

test('call dialogue: a closed line stays closed and an older one never comes back', () => {
  assert.equal(pickStageLine([line('reply', 10), line('event:1', 20)], 'event:1'), null)
  assert.equal(pickStageLine([line('reply', 10), line('event:1', 20)], 'reply')?.key, 'event:1')
  // A new reply after the closed event line shows.
  assert.equal(pickStageLine([line('reply-2', 40), line('event:1', 20)], 'event:1')?.key, 'reply-2')
})

test('call dialogue: pages of two or three lines at the box width; never fewer than 14 letters', () => {
  assert.equal(dialogueCapacity(760), Math.floor(Math.floor((760 - 80) / 18) * 2.4))
  assert.equal(dialogueCapacity(1200), dialogueCapacity(760))
  assert.ok(dialogueCapacity(520) < dialogueCapacity(760))
  assert.equal(dialogueCapacity(80), 14)
  const long = '30쪽? 생각보다 빠르네. …칭찬하는 거 아니야. 그 속도면 오늘 35쪽까지 충분하다는 거지. 대신 틀린 문제는 꼭 다시 풀어 보고 넘어가. 그리고 30분 지나면 한 번 쉬어. 쉬는 것도 공부니까. 알았지?'
  for (const width of [520, 760]) {
    const pages = dialoguePages(long, dialogueCapacity(width))
    assert.ok(pages.length >= 2, `${width}: ${pages.length}`)
    for (const page of pages) assert.ok(Array.from(page).length <= dialogueCapacity(width))
  }
})

test('call dialogue: a streamed reply only adds to its last page (earlier pages stay as they were)', () => {
  const full = '좋아. 그럼 오늘은 35쪽까지 해 보자. 모르는 문제는 표시해 두고 나중에 같이 보자. 쉬는 시간도 꼭 챙기고.'
  const max = 30
  const before = dialoguePages(full.slice(0, 40), max)
  const after = dialoguePages(full, max)
  for (const [index, page] of before.slice(0, -1).entries()) assert.equal(after[index], page)
})

test('call dialogue: the chat letter pace and the page holds', () => {
  assert.equal(letterPace('가'.repeat(50)), 32)
  assert.equal(letterPace(''), 32)
  assert.equal(dialogueHold(40, false), 800 + 40 * 32)
  assert.equal(dialogueHold(40, true), 2400 + 40 * 40)
  assert.equal(dialogueHold(200, true), 6000)
})
