import test from 'node:test'
import assert from 'node:assert/strict'
import { accountRequest, closeAccountRequest, legacyAccountDestination } from '../src/features/profile/account-location.ts'

test('retired calendar URLs open settings without restoring schedule creation', () => {
  assert.equal(legacyAccountDestination('', ''), '/?account=profile')
  assert.equal(legacyAccountDestination('', '#schedule'), '/?account=settings')
  assert.equal(legacyAccountDestination('?add=1', ''), '/?account=settings')
  assert.equal(legacyAccountDestination('?add=1&next=https://outside.invalid&fromRoom=1', '#schedule'), '/?account=settings')
})

test('dialog entry requests accept profile/settings and safely map retired calendar links', () => {
  assert.deepEqual(accountRequest('?account=profile'), { view: 'profile' })
  assert.deepEqual(accountRequest('?account=settings'), { view: 'settings' })
  assert.deepEqual(accountRequest('?account=schedule&add=1'), { view: 'settings' })
  for (const value of ['logout', 'withdraw', 'constructor', '__proto__', '']) assert.equal(accountRequest(`?account=${value}`), null)
})

test('closing a linked dialog removes only its consumed parameters', () => {
  assert.equal(closeAccountRequest('?account=schedule&add=1&source=link'), '?source=link')
  assert.equal(closeAccountRequest('?account=profile&add=1&source=link'), '?add=1&source=link')
  assert.equal(closeAccountRequest('?account=profile'), '')
  assert.equal(closeAccountRequest('?add=1&source=link'), '?add=1&source=link')
})
