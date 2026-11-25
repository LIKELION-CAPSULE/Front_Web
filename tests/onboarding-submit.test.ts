import test from 'node:test'
import assert from 'node:assert/strict'
import { createFinishGate } from '../src/features/profile/onboarding-submit.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('a second 시작하기 or a 건너뛰기 while the invite check runs does not save twice', async () => {
  const gate = createFinishGate()
  const check = deferred<boolean>()
  const saves: string[] = []
  const first = gate.run({ validate: () => check.promise, isCurrent: () => true, save: async () => { saves.push('with code') } })
  assert.equal(gate.isPending(), true, 'locked before the check finishes')
  // Second press, then 건너뛰기 (no validation): both refused while the first finish is running.
  assert.equal(await gate.run({ validate: async () => true, isCurrent: () => true, save: async () => { saves.push('again') } }), 'busy')
  assert.equal(await gate.run({ isCurrent: () => true, save: async () => { saves.push('skip') } }), 'busy')
  check.resolve(true)
  assert.equal(await first, 'saved')
  assert.deepEqual(saves, ['with code'])
  assert.equal(gate.isPending(), false)
})

test('a slow save cannot be overtaken by a later one', async () => {
  const gate = createFinishGate()
  const save = deferred<void>()
  const order: string[] = []
  const first = gate.run({ isCurrent: () => true, save: async () => { await save.promise; order.push('first') } })
  assert.equal(await gate.run({ isCurrent: () => true, save: async () => { order.push('late') } }), 'busy')
  save.resolve()
  await first
  assert.deepEqual(order, ['first'])
})

test('an invalid code or a failed save opens the lock again', async () => {
  const gate = createFinishGate()
  assert.equal(await gate.run({ validate: async () => false, isCurrent: () => true, save: async () => { throw new Error('not reached') } }), 'invalid')
  assert.equal(gate.isPending(), false)
  await assert.rejects(gate.run({ isCurrent: () => true, save: async () => { throw new Error('503') } }), /503/)
  assert.equal(gate.isPending(), false)
  assert.equal(await gate.run({ isCurrent: () => true, save: async () => {} }), 'saved')
})

test('nothing is saved when the screen was left or the account changed during the check', async () => {
  const gate = createFinishGate()
  const check = deferred<boolean>()
  let current = true
  let saved = false
  const pending = gate.run({ validate: () => check.promise, isCurrent: () => current, save: async () => { saved = true } })
  current = false // unmounted or signed out / another account while the check was running
  check.resolve(true)
  assert.equal(await pending, 'stale')
  assert.equal(saved, false)
  assert.equal(gate.isPending(), false)
})
