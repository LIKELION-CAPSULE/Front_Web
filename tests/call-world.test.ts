import assert from 'node:assert/strict'
import test from 'node:test'
import { callWorld, callWorldLabel } from '../src/features/mates/call-world.ts'
import { launchMates } from '../src/features/mates/catalog.ts'

test('the call header shows no world until the call says which one it is in', () => {
  // The call background alone is not a world (shared picture, no fixed mapping): no chip.
  assert.equal(callWorld(), null)
  assert.equal(callWorld({ selected: null }), null)
})

test('a chosen world shows as 「EP.05 채린이네 집」', () => {
  const world = callWorld({ selected: { episode: 5, place: '채린이네 집', placeholder: false } })
  assert.ok(world)
  assert.equal(callWorldLabel(world), 'EP.05 채린이네 집')
})

test('a placeholder or broken world is never shown', () => {
  assert.equal(callWorld({ selected: { episode: 3, place: '준비 중', placeholder: true } }), null)
  assert.equal(callWorld({ selected: { episode: 3, place: '  ', placeholder: false } }), null)
  assert.equal(callWorld({ selected: { episode: 0, place: '학교', placeholder: false } }), null)
})

test('each launch mate has a short call header relation line', () => {
  for (const mate of launchMates) {
    assert.ok(mate.callTag, mate.id)
    assert.ok(mate.callTag.length <= 10, `${mate.id}: ${mate.callTag}`)
  }
  assert.equal(launchMates.find(mate => mate.id === 'chaerin')?.callTag, '같은 반 짝꿍')
})
