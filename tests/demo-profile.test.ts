import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { DEFAULT_PROFILE_NAME, migrateDemoProfile } from '../src/features/demo/profile.ts'

test('the old demo nickname migrates without resetting records, avatar or credit history', () => {
  const source = createDemoState()
  source.profile.name = '승희'
  source.messages = [
    {
      id: 'reply',
      sessionId: 'sample',
      characterId: 'chaerin',
      sender: 'character',
      text: '승희야, 잘하고 있어.',
      voice: false,
    },
    {
      id: 'message',
      sessionId: 'sample',
      characterId: 'chaerin',
      sender: 'user',
      text: '내가 쓴 메모',
      voice: false,
    },
  ]
  const next = migrateDemoProfile(source)
  assert.equal(next.profile.name, DEFAULT_PROFILE_NAME)
  assert.equal(next.records, source.records)
  assert.equal(next.ledger, source.ledger)
  assert.equal(next.profile.avatar, source.profile.avatar)
  assert.equal(next.credits, source.credits)
  assert.equal(source.profile.name, '승희')
  assert.equal(next.messages[0]!.text, `${DEFAULT_PROFILE_NAME}, 잘하고 있어.`)
  assert.equal(next.messages[1], source.messages[1])
  assert.equal(migrateDemoProfile(next), next)
})

test('custom names survive migration and blank profile input uses the new default', () => {
  const custom = createDemoState()
  custom.profile.name = '민지'
  assert.equal(migrateDemoProfile(custom), custom)
  const next = demoReducer(custom, { type: 'PROFILE', name: ' ', avatar: custom.profile.avatar })
  assert.equal(next.profile.name, DEFAULT_PROFILE_NAME)
})
