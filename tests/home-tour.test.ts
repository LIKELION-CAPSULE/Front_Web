import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTourSteps, readMs } from '../src/features/mates/components/home-tour-steps.ts'

const element = (name: string) => ({ name }) as unknown as Element
function screen(present: string[]) {
  return (selector: string) => {
    const hit = present.find((name) => selector.includes(`data-tour="${name}"`))
    return hit ? element(hit) : null
  }
}
const ALL = ['mate-card', 'mate-card-status', 'connect', 'nav-my-mates', 'nav-records', 'credits', 'profile']

test('the tour covers every feature the user picked, in order, ending with a line', () => {
  const steps = buildTourSteps(screen(ALL))
  assert.deepEqual(steps.map((step) => step.id), ['mate-card', 'connect', 'nav-my-mates', 'nav-records', 'credits', 'profile', 'outro'])
  assert.deepEqual(steps.map((step) => step.action), ['hover', 'click', 'hover', 'hover', 'hover', 'hover', 'say'])
  // Only the 「연결하기」 step presses (visually); the others hover.
  assert.equal(steps.filter((step) => step.action === 'click').length, 1)
  assert.equal(steps.at(-1)!.target, null)
  // Labels open to the left at the right edge of the header.
  assert.deepEqual(steps.filter((step) => step.labelSide === 'left').map((step) => step.id), ['credits', 'profile'])
})

test('with a reconnect button the cursor presses it; without one it points at the first card\'s 「연결 가능」', () => {
  const withButton = buildTourSteps(screen(ALL)).find((step) => step.id === 'connect')!
  assert.match(withButton.say, /연결하기를 누르면 나랑 영상통화처럼 같이 있는 거야\. 음성이랑 PIP도 돼\./)
  assert.equal((withButton.target!() as unknown as { name: string }).name, 'connect')
  const firstVisit = buildTourSteps(screen(ALL.filter((name) => name !== 'connect'))).find((step) => step.id === 'connect')!
  assert.match(firstVisit.say, /카드를 누르면 상세에서 연결할 수 있어/)
  assert.match(firstVisit.say, /영상통화처럼/)
  assert.match(firstVisit.say, /음성이랑 PIP도 돼/)
  assert.equal((firstVisit.target!() as unknown as { name: string }).name, 'mate-card-status')
})

test('a target the home screen does not show is skipped (e.g. no credits yet)', () => {
  const steps = buildTourSteps(screen(ALL.filter((name) => name !== 'credits')))
  assert.ok(!steps.some((step) => step.id === 'credits'))
  assert.equal(steps.length, 6)
})

test('the arrow lands on an edge or a lower corner of every target, never its middle (it would cover the words)', () => {
  for (const step of buildTourSteps(screen(ALL))) {
    if (!step.target) continue
    assert.ok(step.at, step.id)
    const { x, y } = step.at!
    assert.ok(x >= 0.85 || y >= 0.85, `${step.id}: ${x},${y}`)
  }
})

test('each line stays up long enough to read', () => {
  assert.equal(readMs('짧아'), 2600)
  assert.ok(readMs('카드를 누르면 상세에서 연결할 수 있어. 연결하면 영상통화처럼 같이 있는 거야. 음성이랑 PIP도 돼.') > 6000)
})
