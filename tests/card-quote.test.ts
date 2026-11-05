import assert from 'node:assert/strict'
import test from 'node:test'
import { fitCardQuote } from '../src/features/reports/card-quote.ts'
import { capsuleCardLayout as layout } from '../src/features/reports/capsule-card-layout.ts'

// Every character (and space) is one em wide: easy to reason about line breaks.
const measure = (text: string, fontSize: number) => text.length * fontSize
const bottom = layout.quote.top + layout.quote.maxHeight
const insideCard = (fit: ReturnType<typeof fitCardQuote>) => {
  assert.ok(fit.top >= layout.quote.top)
  assert.ok(fit.top + fit.lines.length * fit.lineHeight <= bottom)
  for (const line of fit.lines) assert.ok(measure(line, fit.fontSize) <= layout.contentWidth, line)
}

test('a short quote keeps the full size and the original position', () => {
  const fit = fitCardQuote('내일도 같이 하자.', measure)
  assert.deepEqual(fit, { top: layout.quote.preferredTop, fontSize: 24, lineHeight: 36, lines: ['내일도 같이 하자.'] })
})

test('a long quote steps the font down and stays inside the card', () => {
  const text = '목표 반도 못 채웠잖아. ...내일은 나보다 먼저 일어나지 마.'
  const fit = fitCardQuote(text, measure)
  assert.ok(fit.fontSize < 24)
  insideCard(fit)
  assert.equal(fit.lines.join(' '), text)
})

test('a word wider than a line breaks inside the word', () => {
  const fit = fitCardQuote('가'.repeat(30), measure)
  insideCard(fit)
  assert.equal(fit.lines.join(''), '가'.repeat(30))
})

test('a quote too long even at the smallest size ends with an ellipsis', () => {
  const fit = fitCardQuote('아주 긴 문장 '.repeat(40), measure)
  assert.equal(fit.fontSize, layout.quote.fontSizes.at(-1))
  assert.ok(fit.lines.at(-1)!.endsWith('…'))
  insideCard(fit)
})
