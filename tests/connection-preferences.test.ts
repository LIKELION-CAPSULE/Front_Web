import test from 'node:test'
import assert from 'node:assert/strict'
import { PipSpeechPreference, pipSpeechKey } from '../src/features/mates/connection-preferences.ts'
import { removeAccountSnapshots } from '../src/features/auth/account-storage.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('PIP bubble preferences survive reopening and remain isolated by account', () => {
  const storage = memoryStorage()
  const first = new PipSpeechPreference(storage, 7)
  assert.equal(first.getSnapshot(), true)
  first.setVisible(false)
  assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), false)
  assert.equal(new PipSpeechPreference(storage, 8).getSnapshot(), true)
  assert.equal(new PipSpeechPreference(storage, null).getSnapshot(), true)
  assert.deepEqual([...storage.values.keys()], [pipSpeechKey(7)])
})

test('invalid or unavailable storage keeps the visible default and allows an in-memory toggle', () => {
  for (const value of ['{', 'null', '0', '"false"', '{"visible":false}']) {
    const storage = memoryStorage(); storage.setItem(pipSpeechKey(7), value)
    assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), true)
  }
  const preference = new PipSpeechPreference({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }, 7)
  preference.setVisible(false)
  assert.equal(preference.getSnapshot(), false)
  preference.setVisible(true)
  assert.equal(preference.getSnapshot(), true)
})

test('only changed PIP preferences notify subscribers, and removed listeners stay removed', () => {
  const preference = new PipSpeechPreference(null, null)
  let count = 0
  const unsubscribe = preference.subscribe(() => { count++ })
  preference.setVisible(true); assert.equal(count, 0)
  preference.setVisible(false); assert.equal(count, 1)
  unsubscribe(); preference.setVisible(true); assert.equal(count, 1)
})

test('withdrawal removes the selected account PIP preference while retaining other accounts', () => {
  const storage = memoryStorage()
  new PipSpeechPreference(storage, 7).setVisible(false)
  new PipSpeechPreference(storage, 8).setVisible(false)
  removeAccountSnapshots({ get length() { return storage.values.size }, key: index => [...storage.values.keys()][index] ?? null, removeItem: key => { storage.values.delete(key) } }, 7)
  assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), true)
  assert.equal(new PipSpeechPreference(storage, 8).getSnapshot(), false)
})
