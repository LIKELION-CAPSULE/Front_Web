import assert from 'node:assert/strict'
import test from 'node:test'
import { ATTENDANCE_COUNTING, CYCLE_DAYS, DAILY_ATTENDANCE_CREDIT, DEFAULT_REWARDS } from '../src/features/attendance/attendance-config.ts'
import { attendanceFromDays, countedDays, previousDay } from '../src/features/attendance/attendance-model.ts'
import { attendanceFromApi } from '../src/features/attendance/attendance-service.ts'
import { ATTENDANCE_SOURCE } from '../src/features/attendance/attendance-source.ts'
import { CreditDataError } from '../src/features/credits/credits-data.ts'

const TODAY = '2026-11-27'
const days = (...keys: string[]) => keys

test('the reward table is 1,500 every day; milestones stay decoration only', () => {
  assert.ok(DEFAULT_REWARDS.every(reward => reward.credit === DAILY_ATTENDANCE_CREDIT))
  assert.equal(new Set(DEFAULT_REWARDS.map(reward => reward.credit)).size, 1)
  assert.deepEqual(DEFAULT_REWARDS.filter(reward => reward.milestone).map(reward => reward.day), [3, 7])
  // The switches as shipped: the server as it is, 7 days, counted cumulatively (the mock rule).
  assert.deepEqual([ATTENDANCE_SOURCE, CYCLE_DAYS, ATTENDANCE_COUNTING], ['credits', 7, 'cumulative'])
})

test('credits source: today granted, not yet received → not checked in, 1,500 pending; received → the next day of the cycle', () => {
  const earlier = days('2026-11-20', '2026-11-22', '2026-11-25', '2026-11-26')
  const before = attendanceFromDays([...earlier, TODAY], TODAY)
  assert.deepEqual([before.cycleDay, before.checkedToday, before.totalDays, before.pendingCredit], [4, false, 4, 1500])
  const after = attendanceFromDays([...earlier, TODAY], TODAY, { received: true })
  assert.deepEqual([after.cycleDay, after.checkedToday, after.totalDays, after.pendingCredit], [5, true, 5, 0])
  // The flag says granted before 34 shows it.
  assert.equal(attendanceFromDays(earlier, TODAY, { grantedToday: true }).pendingCredit, 1500)
  // Nothing granted today (the page stayed open past 05:00): nothing pending, not checked in.
  const stale = attendanceFromDays(earlier, TODAY, { received: true })
  assert.deepEqual([stale.cycleDay, stale.checkedToday, stale.pendingCredit], [4, false, 0])
  // A first day ever.
  assert.deepEqual([attendanceFromDays([TODAY], TODAY).cycleDay, attendanceFromDays([TODAY], TODAY, { received: true }).cycleDay], [0, 1])
})

test('cumulative: missed days change nothing; a finished cycle starts again at day 1 the next day', () => {
  const seven = ['2026-11-10', '2026-11-12', '2026-11-14', '2026-11-16', '2026-11-18', '2026-11-20', '2026-11-26']
  assert.equal(attendanceFromDays(seven, TODAY).cycleDay, 0)
  assert.equal(attendanceFromDays([...seven, TODAY], TODAY, { received: true }).cycleDay, 1)
  const six = seven.slice(1)
  assert.equal(attendanceFromDays([...six, TODAY], TODAY, { received: true }).cycleDay, 7)
})

test('consecutive (switchable): only the unbroken run ending yesterday counts', () => {
  assert.equal(previousDay('2026-12-01'), '2026-11-30')
  assert.equal(previousDay('2027-01-01'), '2026-12-31')
  const set = new Set(['2026-11-20', '2026-11-24', '2026-11-25', '2026-11-26'])
  assert.equal(countedDays(set, TODAY, 'cumulative'), 4)
  assert.equal(countedDays(set, TODAY, 'consecutive'), 3)
  assert.equal(countedDays(new Set(['2026-11-25']), TODAY, 'consecutive'), 0)
  assert.equal(attendanceFromDays([...set, TODAY], TODAY, { received: true, counting: 'consecutive' }).cycleDay, 4)
})

test('attendance-api source (proposed GET /attendance): the cycle as sent; required fields checked', () => {
  const state = attendanceFromApi({ checkedToday: false, cycleDay: 4, totalDays: 11, rewardPerDay: 1500 })
  assert.deepEqual([state.cycleDay, state.checkedToday, state.totalDays, state.pendingCredit], [4, false, 11, 0])
  assert.ok(state.rewards.every(reward => reward.credit === 1500))
  assert.equal(attendanceFromApi({ checkedToday: true, cycleDay: 9 }).cycleDay, 7)
  assert.equal(attendanceFromApi({ checkedToday: true, cycleDay: 3, rewardPerDay: 0 }).rewards[0]?.credit, 1500)
  for (const broken of [null, {}, { checkedToday: true }, { cycleDay: 2 }, { checkedToday: 'yes', cycleDay: 2 }]) {
    assert.throws(() => attendanceFromApi(broken as never), CreditDataError)
  }
})
