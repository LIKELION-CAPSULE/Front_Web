import assert from 'node:assert/strict'
import test from 'node:test'
import { attendanceGrantFor, clearServerCredits, noteServerCredits, serverCreditsAge, serverCreditsFor, takeAttendanceGrant } from '../src/features/backend/server-credits.ts'

test('server credits: /me starts the account, later responses refresh it, another account or sign-out never sees it', () => {
  clearServerCredits()
  // Inside a connection, before any account is known: nothing to refresh.
  noteServerCredits({ todayRemaining: 10 })
  assert.equal(serverCreditsFor(7), null)

  // 8 /me (with the account) → the header balance.
  noteServerCredits({ todayRemaining: 3500, attendanceRemaining: 1500, inviteBalance: 2000 }, 7)
  assert.equal(serverCreditsFor(7)?.todayRemaining, 3500)
  assert.ok(serverCreditsAge(7) < 1000)

  // 20 · 28 after a 고급 turn (no account given): the same account, merged.
  noteServerCredits({ todayRemaining: 3470, attendanceRemaining: 1470 })
  assert.deepEqual(serverCreditsFor(7), { todayRemaining: 3470, attendanceRemaining: 1470, inviteBalance: 2000 })

  // A summary without a usable balance changes nothing (19 without tts answers credits: null).
  noteServerCredits(null)
  noteServerCredits({ low: true })
  noteServerCredits({ todayRemaining: Number.NaN })
  assert.equal(serverCreditsFor(7)?.todayRemaining, 3470)

  // Another account never reads it; a new /me for it replaces the entry (nothing carried over).
  assert.equal(serverCreditsFor(8), null)
  noteServerCredits({ todayRemaining: 100 }, 8)
  assert.deepEqual(serverCreditsFor(8), { todayRemaining: 100 })
  assert.equal(serverCreditsFor(7), null)
  assert.equal(serverCreditsAge(7), Number.POSITIVE_INFINITY)

  // Sign-out.
  clearServerCredits()
  assert.equal(serverCreditsFor(8), null)
  noteServerCredits({ todayRemaining: 5 })
  assert.equal(serverCreditsFor(8), null)
})

test('attendance grant: a response saying today was just granted is kept once for the home button, per account', () => {
  clearServerCredits()
  noteServerCredits({ todayRemaining: 3500, attendanceRemaining: 1500, attendanceGrantedNow: true }, 7)
  // The flag is not part of the kept summary.
  assert.equal(serverCreditsFor(7)?.attendanceGrantedNow, undefined)
  assert.equal(attendanceGrantFor(7)?.amount, 1500)
  assert.equal(attendanceGrantFor(8), null)
  // Later responses without the flag keep it; it is handed over once.
  noteServerCredits({ todayRemaining: 3470, attendanceRemaining: 1470 })
  assert.equal(takeAttendanceGrant(7)?.amount, 1500)
  assert.equal(takeAttendanceGrant(7), null)
  // A past business day's grant is not today's.
  noteServerCredits({ todayRemaining: 1500, attendanceGrantedNow: true }, 7)
  assert.equal(attendanceGrantFor(7, Date.now() + 2 * 86_400_000), null)
  // Another account or sign-out drops it.
  noteServerCredits({ todayRemaining: 10 }, 8)
  assert.equal(attendanceGrantFor(7), null)
  clearServerCredits()
})
