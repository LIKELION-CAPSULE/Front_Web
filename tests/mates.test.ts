import test from 'node:test'
import assert from 'node:assert/strict'
import { availableMates, mateByName, mateProfileByName } from '../src/features/mates/catalog.ts'
import { CONNECTION_IDLE_MS, ConnectionIdleClock } from '../src/features/mates/connection-idle.ts'
import { isSessionSurface } from '../src/features/mates/session-surface.ts'

test('launch catalogue admits approved server characters without adding demo rooms or the unspecified male mate', () => {
  const mates = availableMates({ rooms: [
    { id: 9, characters: [{ id: 4, name: '도윤' }] },
    { id: 11, characters: [{ id: 42, name: '채린', profileImageUrl: '/chaerin.webp' }, { id: 43, name: '수아' }] },
    { id: 12, characters: [{ id: 44, name: '채린' }] },
  ] })
  assert.equal(mates.length, 1)
  assert.equal(mates[0]?.id, 'chaerin')
  assert.equal(mates[0]?.roomId, '11')
  assert.equal(mates[0]?.characterId, '42')
  assert.equal(mates[0]?.image, '/chaerin.webp')
  assert.equal(mateByName('채린', mates)?.id, 'chaerin')
  assert.equal(mateByName('도윤', mates), undefined)
})

test('empty, unavailable and malformed server IDs cannot create locally simulated connections', () => {
  assert.deepEqual(availableMates(null), [])
  assert.deepEqual(availableMates({ rooms: [] }), [])
  for (const bad of [0, -1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(availableMates({ rooms: [{ id: bad, characters: [{ id: 1, name: '채린' }] }] }), [])
    assert.deepEqual(availableMates({ rooms: [{ id: 1, characters: [{ id: bad, name: '채린' }] }] }), [])
  }
})

test('the temporary Chaerin mapping retains the existing Malfoy server identity without changing its response', () => {
  const home = { rooms: [{ id: 11, characters: [{ id: 42, name: '말포이 TS', profileImageUrl: '/existing.webp' }] }] }
  const before = structuredClone(home)
  const mates = availableMates(home)
  assert.equal(mates.length, 1)
  assert.equal(mates[0]?.name, '채린')
  assert.equal(mates[0]?.roomId, '11')
  assert.equal(mates[0]?.characterId, '42')
  assert.equal(mates[0]?.image, '/existing.webp')
  assert.equal(mateByName(' 말포이 TS ', mates)?.id, 'chaerin')
  assert.equal(mateByName('말포이', mates)?.id, 'chaerin')
  assert.equal(mateProfileByName('말포이TS')?.name, '채린')
  assert.equal(mateByName('수아', mates), undefined)
  assert.deepEqual(home, before)
})

test('a dedicated Chaerin entry takes priority and invalid temporary entries never gain a fabricated ID', () => {
  const mates = availableMates({ rooms: [
    { id: 11, characters: [{ id: 42, name: '말포이 TS' }] },
    { id: 12, characters: [{ id: 43, name: '채린' }] },
  ] })
  assert.equal(mates.length, 1)
  assert.equal(mates[0]?.roomId, '12')
  assert.equal(mates[0]?.characterId, '43')
  assert.deepEqual(availableMates({ rooms: [{ id: 0, characters: [{ id: 42, name: '말포이 TS' }] }] }), [])
  assert.deepEqual(availableMates({ rooms: [{ id: 11, characters: [{ id: 0, name: '말포이 TS' }] }] }), [])
})

test('a camera-off connection ends after ten minutes without input and input restarts that clock', () => {
  const idle = new ConnectionIdleClock(0)
  assert.equal(idle.remaining(1000, false, 'unknown'), CONNECTION_IDLE_MS)
  assert.equal(idle.remaining(1000 + CONNECTION_IDLE_MS - 1, false, 'unknown'), 1)
  idle.input(1000 + CONNECTION_IDLE_MS - 1)
  assert.equal(idle.remaining(1000 + CONNECTION_IDLE_MS, false, 'unknown'), CONNECTION_IDLE_MS - 1)
  assert.equal(idle.remaining(1000 + 2 * CONNECTION_IDLE_MS - 1, false, 'unknown'), 0)
})

test('camera presence, detector uncertainty and mode transitions do not count as continuous absence', () => {
  const idle = new ConnectionIdleClock(0)
  assert.equal(idle.remaining(1000, true, 'absent'), CONNECTION_IDLE_MS)
  idle.input(2000)
  assert.equal(idle.remaining(1000 + CONNECTION_IDLE_MS, true, 'absent'), 0)
  assert.equal(idle.remaining(1000 + CONNECTION_IDLE_MS, true, 'present'), CONNECTION_IDLE_MS)
  assert.equal(idle.remaining(900000, true, 'absent'), CONNECTION_IDLE_MS)
  assert.equal(idle.remaining(1000000, true, 'unknown'), CONNECTION_IDLE_MS)
  assert.equal(idle.remaining(2000000, true, 'absent'), CONNECTION_IDLE_MS)
  assert.equal(idle.remaining(2000001, false, 'unknown'), CONNECTION_IDLE_MS)
})

test('only the active connection or its legacy session surface can keep camera media alive', () => {
  const active = { id: '31', mateId: 'chaerin' }
  assert.equal(isSessionSurface('/connect/chaerin', active), true)
  assert.equal(isSessionSurface('/study/31', active), true)
  for (const path of ['/', '/mates/chaerin', '/connect/other', '/study/32']) assert.equal(isSessionSurface(path, active), false)
  assert.equal(isSessionSurface('/connect/chaerin', { id: '31' }), false)
})
