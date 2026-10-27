import assert from 'node:assert/strict'
import test from 'node:test'
import { daysInMonth, wheelDate } from '../src/shared/lib/wheel-date.ts'

test('wheel dates clamp the selected day to the new month and leap year', () => {
  assert.equal(daysInMonth(2028, 2), 29)
  assert.equal(daysInMonth(2027, 2), 28)
  assert.equal(wheelDate(2028, 2, 31), '2028-02-29')
  assert.equal(wheelDate(2027, 2, 29), '2027-02-28')
  assert.equal(wheelDate(2026, 4, 31), '2026-04-30')
})

test('appointment wheel dates respect the minimum date without rejecting valid past schedules', () => {
  assert.equal(wheelDate(2026, 9, 20, '2026-10-28'), '2026-10-28')
  assert.equal(wheelDate(2026, 10, 29, '2026-10-28'), '2026-10-29')
  assert.equal(wheelDate(2025, 12, 31), '2025-12-31')
})
