import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseLabelSide, chooseLineBox, cost, labelBox, overlap } from '../src/features/tour/tour-placement.ts'

const viewport = { width: 1440, height: 900 }
const size = { width: 240, height: 30 }

test('label boxes sit where the cursor anchor puts them', () => {
  const tip = { x: 500, y: 400 }
  assert.deepEqual(labelBox('right-down', tip, size), { left: 519, top: 427, right: 759, bottom: 457 })
  assert.deepEqual(labelBox('left-down', tip, size), { left: 252, top: 427, right: 492, bottom: 457 })
  // Above: clear of the target's row (the tip is 40px below the target's top edge).
  assert.deepEqual(labelBox('right-up', tip, size, 40), { left: 519, top: 324, right: 759, bottom: 354 })
})

test('the preferred side stays when it covers nothing', () => {
  const avoid = { controls: [{ left: 0, top: 0, right: 100, bottom: 40 }], viewport }
  assert.equal(chooseLabelSide({ x: 500, y: 400 }, size, avoid), 'right-down')
  assert.equal(chooseLabelSide({ x: 500, y: 400 }, size, avoid, 'left-down'), 'left-down')
})

test('a control under the line (the records period tabs and the mate chips below) moves it', () => {
  // Tabs at the top left; the mate filter chips just under them, where the default label would go.
  const tip = { x: 240, y: 180 }
  const chips = [{ left: 120, top: 196, right: 170, bottom: 220 }, { left: 180, top: 196, right: 230, bottom: 220 }, { left: 240, top: 196, right: 300, bottom: 220 }]
  const side = chooseLabelSide(tip, size, { controls: chips, viewport })
  const box = labelBox(side, tip, size)
  assert.ok(chips.every((chip) => overlap(box, chip) === 0), side)
})

test('a dock along the bottom: the label goes above the row, not over the next buttons', () => {
  const button = (left: number) => ({ left, top: 810, right: left + 44, bottom: 854 })
  const dock = [button(380), button(432), button(484), button(536), button(588)]
  const target = button(432)
  const tip = { x: target.left + 44 * 0.9, y: target.top + 44 * 0.94 }
  const lift = tip.y - target.top
  const side = chooseLabelSide(tip, size, { controls: dock.filter((value) => value !== target), viewport }, 'right-down', lift)
  assert.match(side, /-up$/)
  const box = labelBox(side, tip, size, lift)
  assert.ok(dock.every((value) => overlap(box, value) === 0))
})

test('off screen and the tour panel cost more than open space', () => {
  const avoid = { controls: [], panel: { left: 500, top: 820, right: 940, bottom: 876 }, viewport }
  assert.ok(cost({ left: 1300, top: 100, right: 1540, bottom: 130 }, avoid) > 0)
  assert.ok(cost({ left: 520, top: 800, right: 760, bottom: 830 }, avoid) > 0)
  assert.equal(cost({ left: 300, top: 300, right: 540, bottom: 330 }, avoid), 0)
})

test('reduced motion: the line goes below the target, else where it covers nothing — inside a target too large to leave room', () => {
  const line = { width: 320, height: 60 }
  const below = chooseLineBox({ left: 100, top: 100, right: 400, bottom: 160 }, line, { controls: [], viewport })
  assert.equal(below.top, 172)
  // A tall card filling the height next to another card, the header above: just inside its top edge.
  const card = { left: 80, top: 60, right: 500, bottom: 890 }
  const avoid = { controls: [{ left: 80, top: 0, right: 600, bottom: 50 }, { left: 520, top: 60, right: 940, bottom: 890 }], viewport }
  const inside = chooseLineBox(card, line, avoid)
  assert.equal(inside.top, 72)
  assert.equal(avoid.controls.every((control) => overlap(inside, control) === 0), true)
})

test('reduced motion: a small target at the right of its card gets the line ending at its right edge (home card arrow)', () => {
  const line = { width: 320, height: 64 }
  // The arrow at the card's lower right, the next card starting just right of it, the tour panel below in the middle.
  const spot = { left: 324, top: 698, right: 380, bottom: 754 }
  const avoid = { controls: [{ left: 410, top: 405, right: 710, bottom: 765 }], panel: { left: 513, top: 812, right: 927, bottom: 876 }, viewport }
  const box = chooseLineBox(spot, line, avoid)
  assert.equal(box.right, 380)
  assert.equal(cost(box, avoid), 0)
})
