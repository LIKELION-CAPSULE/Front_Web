import assert from 'node:assert/strict'
import test from 'node:test'
import { CYCLE_DAYS, DEFAULT_REWARDS } from '../src/features/attendance/attendance-config.ts'
import { applyCheckIn, dayKey, resolveAttendance } from '../src/features/attendance/attendance-model.ts'

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

test('day keys are local calendar days', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})
