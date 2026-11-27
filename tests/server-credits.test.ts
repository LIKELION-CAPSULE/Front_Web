import assert from 'node:assert/strict'
import test from 'node:test'
import { clearServerCredits, noteServerCredits, serverCreditsAge, serverCreditsFor } from '../src/features/backend/server-credits.ts'

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
