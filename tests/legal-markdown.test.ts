import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLegalInline, parseLegalMarkdown, safeLegalHref } from '../src/features/auth/legal-markdown.ts'

test('legal documents recognize headings and lists without requiring blank lines', () => {
  const blocks = parseLegalMarkdown('# 이용약관\n첫 문장입니다.\n## 제1조\n1. 첫 항목\n2. 둘째 항목\n\n마지막 문장입니다.')
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'paragraph', 'heading', 'list', 'paragraph'])
  assert.equal(blocks[3]?.type === 'list' && blocks[3].items.length, 2)
  assert.equal(blocks[4]?.type === 'paragraph' && blocks[4].text, '마지막 문장입니다.')
})

test('numbered legal lists retain their starting number, nested items and separated paragraphs', () => {
  const blocks = parseLegalMarkdown('3. **첫 항목**\n   - 하위 항목\n   - 두 번째 하위 항목\n4. 마지막 항목\n\n다음 설명')
  const list = blocks[0]
  assert.ok(list?.type === 'list')
  assert.equal(list.start, 3)
  assert.equal(list.items.length, 2)
  const nested = list.items[0]?.[1]
  assert.ok(nested?.type === 'list')
  assert.equal(nested.ordered, false)
  assert.equal(nested.items.length, 2)
  assert.equal(blocks[1]?.type, 'paragraph')
})

test('privacy tables parse alignment separators, escaped pipes and a following section', () => {
  const blocks = parseLegalMarkdown('| 구분 | 내용 |\n| :--- | ---: |\n| 필수 | 이메일 \\| 닉네임 |\n\n### 보유 기간\n6개월')
  assert.deepEqual(blocks[0], { type: 'table', headers: ['구분', '내용'], rows: [['필수', '이메일 | 닉네임']] })
  assert.equal(blocks[1]?.type, 'heading')
  assert.equal(blocks[2]?.type, 'paragraph')
})

test('inline legal formatting separates emphasis, links, code and line breaks', () => {
  const parts = parseLegalInline('**필수** *안내* [문의](mailto:help@example.com) `예시`<br>다음 줄')
  assert.deepEqual(parts.filter(part => part.type !== 'text').map(part => part.type), ['strong', 'emphasis', 'link', 'code', 'break'])
  assert.equal(safeLegalHref('https://example.com/privacy'), 'https://example.com/privacy')
  assert.equal(safeLegalHref('mailto:help@example.com'), 'mailto:help@example.com')
  for (const href of ['javascript:alert(1)', 'data:text/html,hi', '//untrusted.example', 'file:///private']) assert.equal(safeLegalHref(href), null)
  assert.deepEqual(parseLegalInline('<script>alert(1)</script>'), [{ type: 'text', text: '<script>alert(1)</script>' }])
})

test('both retained legal originals retain their articles, clauses and privacy tables', () => {
  for (const name of ['terms', 'privacy']) {
    const source = readFileSync(new URL(`../src/features/auth/data/legal/${name}.md`, import.meta.url), 'utf8')
    const blocks = parseLegalMarkdown(source)
    assert.equal(blocks.filter(block => block.type === 'heading').length, [...source.matchAll(/^### /gm)].length)
    assert.ok(blocks.some(block => block.type === 'list' && block.items.length > 1))
    if (name === 'privacy') assert.ok(blocks.filter(block => block.type === 'table').length >= 3)
  }
})
