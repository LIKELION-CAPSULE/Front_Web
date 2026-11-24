import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAPSULE_MILESTONE_HOURS,
  capsuleBand,
  capsuleKeepsakes,
  keepsakeTitle,
} from '../src/features/mates/capsule-jar/capsule-moments.ts'
import { CHAERIN_JAR_THEME, TIME_BAND_SHIFT, capsuleBandTheme, capsuleJarTheme } from '../src/features/mates/capsule-jar/capsule-jar-theme.ts'
import { PILE, capsulesForConnection, layoutFloor } from '../src/features/mates/capsule-jar/capsule-floor-layout.ts'
import { generateDummyCapsules } from '../src/features/mates/capsule-jar/capsule-jar-dummy.ts'
import type { CapsuleRecord } from '../src/features/mates/capsule-jar/capsule-jar-types.ts'

const seoul = (iso: string) => Date.parse(`${iso}+09:00`)
const HOUR = 3600
const connection = (id: string, start: string, minutes: number): CapsuleRecord => {
  const startedAt = seoul(start)
  return { id, startedAt, endedAt: startedAt + minutes * 60_000, durationSeconds: minutes * 60 }
}

test("time band: by the start, at the records' boundaries (새벽 0–5 · 아침 5–11 · 낮 11–17 · 저녁 17–21 · 밤 21–24)", () => {
  const cases: [string, string][] = [
    ['2026-11-24T00:00:00', 'dawn'],
    ['2026-11-24T04:59:59', 'dawn'],
    ['2026-11-24T05:00:00', 'morning'],
    ['2026-11-24T10:59:59', 'morning'],
    ['2026-11-24T11:00:00', 'day'],
    ['2026-11-24T16:59:59', 'day'],
    ['2026-11-24T17:00:00', 'evening'],
    ['2026-11-24T20:59:59', 'evening'],
    ['2026-11-24T21:00:00', 'night'],
    ['2026-11-24T23:59:59', 'night'],
  ]
  for (const [start, band] of cases) assert.equal(capsuleBand({ startedAt: seoul(start) }), band, start)
  // Across midnight: 23:30 → 00:40 is the night's connection (its start).
  assert.equal(capsuleBand(connection('late', '2026-11-24T23:30:00', 70)), 'night')
})

test('band colours: the same band gives the same colours; violet family, no gold, no glare', () => {
  for (const band of Object.keys(TIME_BAND_SHIFT) as (keyof typeof TIME_BAND_SHIFT)[]) {
    const tinted = capsuleBandTheme(CHAERIN_JAR_THEME, band)
    assert.deepEqual(capsuleBandTheme(CHAERIN_JAR_THEME, band), tinted)
    for (const hex of [tinted.tintHalf, tinted.tintHalfShade, tinted.glow]) {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      assert.ok(b >= r && b > g, `${band} ${hex} stays blue-violet to pink-violet (blue the strongest channel)`)
      assert.ok(!(r > 200 && g > 170 && b < 140), `${band} ${hex} is not gold`)
    }
  }
  // Bands are told apart: dawn bluer than evening, night darker than day.
  const lum = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + Number.parseInt(hex.slice(i, i + 2), 16), 0)
  const red = (hex: string) => Number.parseInt(hex.slice(1, 3), 16)
  assert.ok(red(capsuleBandTheme(CHAERIN_JAR_THEME, 'dawn').glow) < red(capsuleBandTheme(CHAERIN_JAR_THEME, 'evening').glow))
  assert.ok(lum(capsuleBandTheme(CHAERIN_JAR_THEME, 'night').tintHalf) < lum(capsuleBandTheme(CHAERIN_JAR_THEME, 'day').tintHalf))
  // Other mates (hue from the id) get the same kind of shift.
  const other = capsuleJarTheme('someone')
  assert.notEqual(capsuleBandTheme(other, 'dawn').glow, capsuleBandTheme(other, 'evening').glow)
})

test('keepsakes: the connection in which the time together passes a milestone, and the capsule for that moment', () => {
  const list = [
    connection('a', '2026-11-20T19:00:00', 40), // 0:40
    connection('b', '2026-11-21T19:00:00', 40), // 1:20 → passes 1 h, 20 of its 40 minutes in
    connection('c', '2026-11-22T19:00:00', 100), // 3:00 exactly → passes 3 h at its very end
    connection('d', '2026-11-23T19:00:00', 30), // 3:30
  ]
  const keepsakes = capsuleKeepsakes(list, capsulesForConnection)
  assert.deepEqual([...keepsakes.keys()], ['b', 'c'])
  assert.deepEqual(keepsakes.get('b'), { connectionId: 'b', hours: 1, piece: 1 }) // 4 capsules, half way → the 2nd
  assert.deepEqual(keepsakes.get('c'), { connectionId: 'c', hours: 3, piece: capsulesForConnection(100 * 60) - 1 })
  assert.equal(keepsakeTitle(10), '함께한 지 10시간!')
})

test('keepsakes: start order, not list order; one long connection passing several milestones keeps the highest', () => {
  const list = [
    connection('late', '2026-11-22T19:00:00', 20), // 4:50 in all: short of 5 h
    connection('long', '2026-11-21T09:00:00', 4 * 60 + 10), // 0 → 4:10: passes 1 h and 3 h
    connection('first', '2026-11-20T19:00:00', 20),
  ]
  const shuffled = capsuleKeepsakes([...list].reverse(), capsulesForConnection)
  const ordered = capsuleKeepsakes(list, capsulesForConnection)
  assert.deepEqual([...shuffled.entries()], [...ordered.entries()])
  assert.equal(ordered.get('long')?.hours, 3)
  assert.equal(ordered.size, 1)
  // Same start: the id decides, so the result never depends on the list order.
  const tie = [connection('y', '2026-11-20T19:00:00', 40), connection('x', '2026-11-20T19:00:00', 40)]
  assert.deepEqual([...capsuleKeepsakes(tie, capsulesForConnection).keys()], ['y'])
})

test('keepsakes: a connection that has not ended by now is left out and counts toward nothing', () => {
  const list = [connection('a', '2026-11-24T10:00:00', 50), connection('running', '2026-11-24T19:00:00', 120)]
  const now = seoul('2026-11-24T20:00:00')
  assert.equal(capsuleKeepsakes(list, capsulesForConnection, { now }).size, 0)
  assert.deepEqual([...capsuleKeepsakes(list, capsulesForConnection).keys()], ['running'])
})

test('milestones: one constant, increasing; a two-week user gets a few keepsakes in the pile', () => {
  for (let index = 1; index < CAPSULE_MILESTONE_HOURS.length; index++) assert.ok(CAPSULE_MILESTONE_HOURS[index]! > CAPSULE_MILESTONE_HOURS[index - 1]!)
  const capsules = generateDummyCapsules(12, { now: seoul('2026-11-24T23:00:00') })
  const total = capsules.reduce((sum, capsule) => sum + capsule.durationSeconds, 0) / HOUR
  const layout = layoutFloor(capsules)
  const keepsakes = layout.placements.filter((placement) => placement.keepsake)
  // One keepsake capsule per keepsake connection, and every passed milestone is in one of them.
  const byConnection = capsuleKeepsakes(capsules, capsulesForConnection)
  assert.equal(keepsakes.length, byConnection.size)
  assert.equal(Math.max(...keepsakes.map((piece) => piece.keepsake)), Math.max(...CAPSULE_MILESTONE_HOURS.filter((hours) => hours <= total)))
  assert.ok(keepsakes.length >= 2 && keepsakes.length <= 5, `${keepsakes.length} keepsakes for ${total.toFixed(1)} h`)
  // Keepsakes lie in the side bins, beside the mate (never in the middle behind her).
  for (const piece of keepsakes) assert.ok(Math.abs(piece.x) > PILE.binEdge, `keepsake at x ${piece.x}`)
  // The dummy covers several time bands.
  assert.ok(new Set(layout.groups.map((group) => group.band)).size >= 3)
})
