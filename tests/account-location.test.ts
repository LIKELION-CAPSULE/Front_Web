import test from 'node:test'
import assert from 'node:assert/strict'
import { accountRequest, closeAccountRequest, legacyAccountDestination } from '../src/features/profile/account-location.ts'

test('retired account URLs point to the matching home dialog and preserve a requested new schedule', () => {
  assert.equal(legacyAccountDestination('', ''), '/?account=profile')
  assert.equal(legacyAccountDestination('', '#schedule'), '/?account=schedule')
  assert.equal(legacyAccountDestination('?add=1', ''), '/?account=schedule&add=1')
  assert.equal(legacyAccountDestination('?add=1&next=https://outside.invalid&fromRoom=1', '#schedule'), '/?account=schedule&add=1')
})

test('dialog entry requests accept only profile or schedule and never execute account mutations', () => {
  assert.deepEqual(accountRequest('?account=profile'), { view: 'profile', openEditor: false })
  assert.deepEqual(accountRequest('?account=schedule&add=1'), { view: 'schedule', openEditor: true })
  for (const value of ['logout', 'withdraw', 'constructor', '__proto__', '']) assert.equal(accountRequest(`?account=${value}`), null)
})

test('closing a linked dialog removes only its consumed parameters', () => {
  assert.equal(closeAccountRequest('?account=schedule&add=1&source=link'), '?source=link')
  assert.equal(closeAccountRequest('?account=profile&add=1&source=link'), '?add=1&source=link')
  assert.equal(closeAccountRequest('?account=profile'), '')
  assert.equal(closeAccountRequest('?add=1&source=link'), '?add=1&source=link')
})
