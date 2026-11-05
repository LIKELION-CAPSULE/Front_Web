import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareBackground, prepareRoomId } from '../src/features/session/prepare-location.ts'

test('only a study preparation URL selects a background route', () => {
  assert.equal(prepareRoomId('/rooms/101/prepare'), '101')
  assert.equal(prepareRoomId('/rooms/dawn-library/prepare/'), 'dawn-library')
  for (const path of ['/', '/rooms/101', '/rooms/101/prepare/other', '/rooms//prepare', '/rooms/evil\\path/prepare']) assert.equal(prepareRoomId(path), null)
})

test('preparation keeps the real origin location including search, fragment and state', () => {
  for (const pathname of ['/', '/rooms/101', '/characters/201']) {
    const background = { pathname, search: '?source=home', hash: '#rooms', state: { view: 'saved' }, key: 'previous-entry' }
    assert.deepEqual(prepareBackground({ prepareBackground: background }), background)
  }
})

test('a direct entry or malformed state falls back without reusing a modal or external background', () => {
  for (const state of [undefined, null, {}, '101', { prepareBackground: null }, { prepareBackground: { pathname: '/' } }]) assert.equal(prepareBackground(state), null)
  const base = { search: '', hash: '', key: 'entry', state: null }
  for (const pathname of ['https://external.invalid/', '//external.invalid/', '/\\external.invalid', '/login', '/study/9001', '/rooms/101/prepare']) {
    assert.equal(prepareBackground({ prepareBackground: { ...base, pathname } }), null)
  }
  assert.equal(prepareBackground({ prepareBackground: { ...base, pathname: '/', search: 'source=home' } }), null)
  assert.equal(prepareBackground({ prepareBackground: { ...base, pathname: '/', hash: 'rooms' } }), null)
})
