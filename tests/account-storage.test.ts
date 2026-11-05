import test from 'node:test'
import assert from 'node:assert/strict'
import { removeAccountSnapshots } from '../src/features/auth/account-storage.ts'

test('withdrawal removes only the selected account recovery data', () => {
  const values = new Map([
    ['capsule-presence:7:100', 'presence'], ['capsule-session:7:100', 'session'],
    ['capsule-presence:7:101', 'presence'], ['capsule-session:70:100', 'another account'],
    ['capsule-presence:8:100', 'another account'], ['unrelated-preference', 'keep'],
  ])
  const storage = {
    get length() { return values.size },
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
  }
  removeAccountSnapshots(storage, 7)
  assert.deepEqual([...values.keys()], ['capsule-session:70:100', 'capsule-presence:8:100', 'unrelated-preference'])
})
