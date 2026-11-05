import test from 'node:test'
import assert from 'node:assert/strict'
import { readSavedRooms, writeSavedRooms } from '../src/features/rooms/saved-rooms.ts'

test('saved rooms survive loading again, stay account-specific and retain a removal', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(writeSavedRooms(7, ['101', '103'], storage), true)
  assert.deepEqual(readSavedRooms(7, storage), ['101', '103'])
  assert.deepEqual(readSavedRooms(70, storage), [])
  writeSavedRooms(70, ['102'], storage)
  writeSavedRooms(7, ['103'], storage)
  assert.deepEqual(readSavedRooms(7, storage), ['103'])
  assert.deepEqual(readSavedRooms(70, storage), ['102'])
})

test('malformed saved preferences cannot break loading or introduce duplicate and invalid room IDs', () => {
  for (const input of ['{', 'null', '{}', '42']) assert.deepEqual(readSavedRooms(7, { getItem: () => input }), [])
  assert.deepEqual(readSavedRooms(7, { getItem: () => '["101", null, 102, "", " ", "101", "room-2"]' }), ['101', 'room-2'])
})

test('unavailable browser storage is handled without throwing', () => {
  const storage = { getItem: (): string => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
  assert.deepEqual(readSavedRooms(7, storage), [])
  assert.equal(writeSavedRooms(7, ['101'], storage), false)
})

test('missing or invalid accounts never read or overwrite another account preference', () => {
  const storage = { getItem: (): string => { assert.fail('must not read storage') }, setItem: () => { assert.fail('must not write storage') } }
  for (const userId of [undefined, 0, -1, NaN, Infinity, 1.5]) {
    assert.deepEqual(readSavedRooms(userId, storage), [])
    assert.equal(writeSavedRooms(userId, ['101'], storage), false)
  }
})
