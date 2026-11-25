import test from 'node:test'
import assert from 'node:assert/strict'
import { availableMates, mateByName, mateProfileByName } from '../src/features/mates/catalog.ts'
import { CONNECTION_IDLE_MS, ConnectionIdleClock } from '../src/features/mates/connection-idle.ts'
import { isSessionSurface } from '../src/features/mates/session-surface.ts'

test('launch catalogue admits approved server mates without adding demo mates or unknown names', () => {
  const mates = availableMates({ mates: [
    { id: 4, name: '도윤' },
    { id: 42, name: '채린', cardImageUrl: '/chaerin.webp' },
    { id: 43, name: '수아' },
    { id: 44, name: '채린' },
  ] })
  assert.equal(mates.length, 1)
  assert.equal(mates[0]?.id, 'chaerin')
  assert.equal(mates[0]?.roomId, '42', 'room and character are the mate id since 11-25')
  assert.equal(mates[0]?.characterId, '42')
  assert.equal(mates[0]?.image, '/chaerin.webp')
  assert.equal(mateByName('채린', mates)?.id, 'chaerin')
  assert.equal(mateByName('도윤', mates), undefined)
})

test('empty, unavailable and malformed server IDs cannot create locally simulated connections', () => {
  assert.deepEqual(availableMates(null), [])
  assert.deepEqual(availableMates({ mates: [] }), [])
  for (const bad of [0, -1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(availableMates({ mates: [{ id: bad, name: '채린' }] }), [])
  }
})

test('the temporary Chaerin mapping retains the existing Malfoy server identity without changing its response', () => {
  const home = { mates: [{ id: 1, name: '말포이', cardImageUrl: '/existing.webp' }] }
  const before = structuredClone(home)
  const mates = availableMates(home)
  assert.equal(mates.length, 1)
  assert.equal(mates[0]?.name, '채린')
  assert.equal(mates[0]?.characterId, '1')
  assert.equal(mates[0]?.image, '/existing.webp')
  assert.equal(mateByName(' 말포이 TS ', mates)?.id, 'chaerin')
  assert.equal(mateByName('말포이', mates)?.id, 'chaerin')
  assert.equal(mateProfileByName('말포이TS')?.name, '채린')
  assert.equal(mateByName('수아', mates), undefined)
  assert.deepEqual(home, before)
})

test('a dedicated Chaerin entry takes priority; an open mate wins over a coming-soon one; bad IDs never gain an ID', () => {
  // 2026-11-25 production order: 1 말포이 · 2 서진 · 3 서진 · 4 채린.
  const mates = availableMates({ mates: [{ id: 1, name: '말포이' }, { id: 2, name: '서진' }, { id: 3, name: '서진' }, { id: 4, name: '채린' }] })
  assert.deepEqual(mates.map(mate => [mate.id, mate.characterId]), [['chaerin', '4'], ['dohyun', '2']])
  const open = availableMates({ mates: [{ id: 2, name: '서진', comingSoon: true }, { id: 3, name: '서진' }] })
  assert.deepEqual(open.map(mate => [mate.id, mate.characterId, mate.comingSoon]), [['dohyun', '3', undefined]])
  assert.equal(availableMates({ mates: [{ id: 2, name: '서진', comingSoon: true }] })[0]?.comingSoon, true)
  assert.deepEqual(availableMates({ mates: [{ id: 0, name: '말포이' }] }), [])
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

test('a connection handed over to another mate keeps that mate and explains it', async () => {
  const { connectedMate } = await import('../src/features/mates/connected-mate.ts')
  const mates = availableMates({ mates: [{ id: 42, name: '채린' }, { id: 43, name: '서진' }] })
  const chaerin = mates[0]!
  assert.deepEqual(connectedMate(chaerin, '42', mates), { mate: chaerin, notice: null })
  const other = connectedMate(chaerin, '43', mates)
  assert.equal(other.mate?.id, 'dohyun')
  assert.equal(other.notice, '다른 곳에서 서도현과 연결 중이었어요. 그 연결을 이어서 할게요.')
  const unknown = connectedMate(chaerin, '99', mates)
  assert.equal(unknown.mate, undefined)
  assert.match(unknown.notice ?? '', /다른 메이트와 연결 중/)
})

test('a 409 resume with the other entry of a persona listed twice opens as that mate, never the mate asked for', async () => {
  const { connectedMate, frontMateOf, withConnectionCharacter } = await import('../src/features/mates/connected-mate.ts')
  // /home: 채린 id 1, 서진 id 2 and 3 (production has the duplicate); 서도현 stands for id 2.
  const mates = availableMates({ mates: [{ id: 1, name: '채린' }, { id: 2, name: '서진' }, { id: 3, name: '서진' }] })
  const [chaerin, dohyun] = mates
  assert.equal(dohyun?.characterId, '2')
  // 채린's start answered 409; the resumed connection is with mate 3 (서진).
  const front = frontMateOf('3', '서진', mates)
  assert.equal(front?.id, 'dohyun', 'matched by the server name, not by the /home card id')
  const actual = connectedMate(chaerin!, '3', mates, front?.id)
  assert.equal(actual.mate?.id, 'dohyun', 'routes to /connect/dohyun, not /connect/chaerin')
  assert.match(actual.notice ?? '', /서도현과 연결 중이었어요/)
  // The call screen keeps the connection's own mate id for messages.
  const shown = withConnectionCharacter(actual.mate, { characterIds: ['3'], roomId: '3' })
  assert.equal(shown?.id, 'dohyun')
  assert.equal(shown?.characterId, '3')
  assert.equal(withConnectionCharacter(dohyun, { characterIds: ['2'] }), dohyun, 'the listed entry is left as it is')
  // Asked for 서도현 and continued with id 3: the same mate, no notice.
  assert.deepEqual(connectedMate(dohyun!, '3', mates, 'dohyun'), { mate: dohyun, notice: null })
  // A mate none of the launch mates maps to: no mate (the caller must not open the one asked for).
  assert.equal(frontMateOf('9', '수아', mates), undefined)
  assert.equal(connectedMate(chaerin!, '9', mates, undefined).mate, undefined)
})
