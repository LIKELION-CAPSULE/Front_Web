import assert from 'node:assert/strict'
import test from 'node:test'
import { ATTENDANCE_LAYOUTS, CYCLE_DAYS, DEFAULT_REWARDS, MAX_SCALE } from '../src/features/attendance/attendance-config.ts'
import {
  applyCheckIn, characterSpot, dayKey, fitLayout, viewportWidth, pageFor, pageOffset, poseSize, resolveAttendance, slotGeometry, slotStatus,
} from '../src/features/attendance/attendance-model.ts'

test('a check-in advances one day, pays that day and cannot repeat the same day', () => {
  const first = applyCheckIn({ cycleDay: 0, lastCheckedOn: null }, '2026-11-24')
  assert.deepEqual(first.state, { cycleDay: 1, checkedToday: true, totalDays: 1, rewards: first.state.rewards })
  assert.equal(first.reward.credit, DEFAULT_REWARDS[0].credit)
  assert.throws(() => applyCheckIn(first.stored, '2026-11-24'))
  const third = applyCheckIn({ cycleDay: 2, lastCheckedOn: '2026-11-20' }, '2026-11-24')
  assert.equal(third.reward.milestone, true)
})

test('missing days never resets progress, and a finished cycle starts again at day 1 the next day', () => {
  // Five days away: still on day 3 of the cycle, nothing lost.
  assert.equal(resolveAttendance({ cycleDay: 3, lastCheckedOn: '2026-11-19' }, '2026-11-24').cycleDay, 3)
  const finished = { cycleDay: CYCLE_DAYS, lastCheckedOn: '2026-11-24' }
  assert.equal(resolveAttendance(finished, '2026-11-24').cycleDay, CYCLE_DAYS)
  const nextDay = resolveAttendance(finished, '2026-11-25')
  assert.deepEqual([nextDay.cycleDay, nextDay.checkedToday], [0, false])
  assert.equal(applyCheckIn(finished, '2026-11-25').reward.day, 1)
})

test('total days keep counting across cycles', () => {
  const seventh = applyCheckIn({ cycleDay: 6, lastCheckedOn: '2026-11-23', totalDays: 11 }, '2026-11-24')
  assert.equal(seventh.state.totalDays, 12)
  const nextCycle = applyCheckIn(seventh.stored, '2026-11-25')
  assert.deepEqual([nextCycle.state.cycleDay, nextCycle.state.totalDays], [1, 13])
  // Older stores without the field never show fewer days than the current cycle.
  assert.equal(resolveAttendance({ cycleDay: 4, lastCheckedOn: null }, '2026-11-24').totalDays, 4)
})

test('slots are done, today or upcoming', () => {
  const statuses = (cycleDay: number, checkedToday: boolean) =>
    Array.from({ length: CYCLE_DAYS }, (_, i) => slotStatus(i, { cycleDay, checkedToday }))
  assert.deepEqual(statuses(2, false), ['done', 'done', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
  assert.deepEqual(statuses(2, true), ['done', 'done', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
})

test('the page follows the character, so day 4 slides to page 2 as it is checked in', () => {
  // The last page is pulled back to days 5–7, so day 7 slides once more.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((day) => pageFor(day)), [0, 0, 0, 0, 1, 1, 1, 2])
  const layout = ATTENDANCE_LAYOUTS.regular
  // After the slide, day 4 sits exactly where day 1 was.
  assert.equal(characterSpot(3, layout).x + pageOffset(1, layout), characterSpot(0, layout).x)
})

test('with four days visible the pages are days 1–4 and 4–7, sliding when day 5 is checked in', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((day) => pageFor(day, 4)), [0, 0, 0, 0, 0, 1, 1, 1])
  const layout = ATTENDANCE_LAYOUTS.compact
  // The second page is pulled back one day so it is never half empty: day 5 lands where day 2 was.
  assert.equal(characterSpot(4, layout).x + pageOffset(1, layout, 4), characterSpot(1, layout).x)
  assert.equal(viewportWidth(layout, 4), layout.insetLeft + layout.pitch * 4 + layout.insetRight)
})

test('the character stands on the platform face and waits on the floor before day 1', () => {
  for (const layout of Object.values(ATTENDANCE_LAYOUTS)) {
    const { floorY, platformTop, platform } = slotGeometry(layout)
    assert.ok(floorY > platformTop && floorY < platformTop + platform.height)
    const onSlot = characterSpot(0, layout)
    const onFloor = characterSpot(-1, layout)
    const height = poseSize('idle', layout).height
    assert.ok(Math.abs(onSlot.y + height - floorY) <= 3, 'feet on the platform face')
    assert.ok(onFloor.y > onSlot.y && onFloor.x < onSlot.x, 'floor spot is lower and to the left')
    assert.ok(Number.isInteger(onSlot.x) && Number.isInteger(onSlot.y))
  }
})

test('day keys are local calendar days', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})

test('the widget grows to fill its space in whole pixels, capped, and falls back to compact when narrow', () => {
  const regular = ATTENDANCE_LAYOUTS.regular
  const wide = fitLayout(620, false)
  assert.ok(wide.scale > 1 && viewportWidth(wide) <= 620)
  assert.ok(Object.values(wide).every((value, i) => Object.keys(wide)[i] === 'scale' || Number.isInteger(value)))
  assert.equal(fitLayout(5000, false).scale, MAX_SCALE)
  assert.equal(fitLayout(viewportWidth(regular), false), regular)
  assert.equal(fitLayout(420, false), ATTENDANCE_LAYOUTS.compact)
  assert.equal(fitLayout(900, true), ATTENDANCE_LAYOUTS.compact)
  // Scaled, the character still lands exactly where day 1 was after the page slide.
  assert.equal(characterSpot(3, wide).x + pageOffset(1, wide), characterSpot(0, wide).x)
})
