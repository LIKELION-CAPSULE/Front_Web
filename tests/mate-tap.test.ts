import test from 'node:test'
import assert from 'node:assert/strict'
import { MateTap, onMate, TAP_COOLDOWN_MS } from '../src/features/mates/mate-tap.ts'

test('a tap reacts once per cooldown, never while the mate is answering, and takes turns through her faces and lines', () => {
  const tap = new MateTap()
  const first = tap.tap('chaerin', false, 0)
  assert.deepEqual(first, { face: 'happy', line: '히히, 간지러워!' })
  assert.equal(tap.tap('chaerin', false, TAP_COOLDOWN_MS - 1), null, 'rapid taps do not pile up')
  assert.equal(tap.tap('chaerin', true, TAP_COOLDOWN_MS), null, 'a reply on its way keeps the stage')
  assert.deepEqual(tap.tap('chaerin', false, TAP_COOLDOWN_MS * 2), { face: 'laugh', line: '왜~ 할 말 있어?' })
})

test('서도현 reacts with his own faces and lines; an unknown mate still gets a gentle default', () => {
  const tap = new MateTap()
  assert.deepEqual(tap.tap('dohyun', false, 0), { face: 'laugh', line: '…왜.' })
  assert.deepEqual(tap.tap('dohyun', false, 2000), { face: 'shy', line: '할 말 있으면 해.' })
  assert.deepEqual(new MateTap().tap('someone', false, 0), { face: 'happy', line: '응?' })
})

test('only the mate herself takes the tap (the middle of the tile, below the very top)', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 800 }
  assert.ok(onMate(rect, 500, 300))
  assert.ok(!onMate(rect, 100, 300), 'the room at the side')
  assert.ok(!onMate(rect, 500, 20), 'above her head')
})
