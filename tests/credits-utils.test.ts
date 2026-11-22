import assert from 'node:assert/strict'
import test from 'node:test'
import { attendanceBarRatio, groupCreditEntriesByDate } from '../src/features/credits/credit-utils.ts'
import type { BetaCreditEntry } from '../src/features/credits/beta-types.ts'

test('attendanceBarRatio computes and clamps ratio for 0, mid, max, over-max, negative, and non-finite values', () => {
  assert.equal(attendanceBarRatio(0), 0)
  assert.equal(attendanceBarRatio(750), 0.5)
  assert.equal(attendanceBarRatio(1500), 1)
  assert.equal(attendanceBarRatio(2400), 1)
  assert.equal(attendanceBarRatio(-120), 0)
  assert.equal(attendanceBarRatio(Number.NaN), 0)
  assert.equal(attendanceBarRatio(Number.POSITIVE_INFINITY), 0)
  assert.equal(attendanceBarRatio(500, 0), 0)
  assert.equal(attendanceBarRatio(500, -100), 0)
})

test('groupCreditEntriesByDate returns empty array for empty input', () => {
  assert.deepEqual(groupCreditEntriesByDate([]), [])
})

test('groupCreditEntriesByDate groups consecutive entries by Asia/Seoul date and formats Korean month/day headings', () => {
  // 2026-11-23 01:00 KST (UTC 2026-11-22 16:00)
  const day2Late = Date.UTC(2026, 10, 22, 16, 0, 0)
  // 2026-11-23 00:10 KST (UTC 2026-11-22 15:10)
  const day2Early = Date.UTC(2026, 10, 22, 15, 10, 0)
  // 2026-11-22 23:40 KST (UTC 2026-11-22 14:40)
  const day1Late = Date.UTC(2026, 10, 22, 14, 40, 0)

  const entries: BetaCreditEntry[] = [
    { id: '1', at: day2Late, description: '보이스 대화 · 채린', kind: 'use', change: -20, balance: 1180 },
    { id: '2', at: day2Early, description: '출석', kind: 'attendance', change: 1500, balance: 1200 },
    { id: '3', at: day1Late, description: '출석분 소멸', kind: 'expiration', change: -320, balance: 200 },
  ]

  const groups = groupCreditEntriesByDate(entries)
  assert.equal(groups.length, 2)
  assert.equal(groups[0]?.dateKey, '2026-11-23')
  assert.equal(groups[0]?.dateHeading, '11월 23일')
  assert.deepEqual(groups[0]?.entries.map((e) => e.id), ['1', '2'])
  assert.equal(groups[1]?.dateKey, '2026-11-22')
  assert.equal(groups[1]?.dateHeading, '11월 22일')
  assert.deepEqual(groups[1]?.entries.map((e) => e.id), ['3'])
})
