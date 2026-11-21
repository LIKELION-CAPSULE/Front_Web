import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeRoomCatalog } from '../src/features/dummy/catalog.ts'
import { alignDummyState, createDummyState, dummySnapshot, dummyStorageKey, finishDummySession, readDummyState, writeDummyState } from '../src/features/dummy/state.ts'
import { studyRooms } from '../src/features/rooms/data/rooms.ts'
import { emptyState } from '../src/features/backend/adapters.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { removeAccountSnapshots } from '../src/features/auth/account-storage.ts'

const now = Date.parse('2026-11-09T12:00:00+09:00')
const serverRoom = { ...studyRooms[0]!, id: '101', artworkId: 'dawn-library', serverRoom: true,
  characters: [{ ...studyRooms[0]!.characters[0]!, id: '201', artworkId: 'chaerin', serverCharacter: true, relation: { level: 3, points: 72 } }],
}
const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) }, key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size } }
}

test('the full catalog preserves real IDs, adds missing friends and opens all nine rooms without duplicates', () => {
  const rooms = mergeRoomCatalog([serverRoom], studyRooms)
  assert.equal(rooms.length, 9)
  assert.deepEqual(rooms[0]!.characters.map(c => c.id), ['201', 'sua', 'dahee'])
  assert.equal(rooms[0]!.characters[0]!.relation?.points, 72)
  assert.equal(mergeRoomCatalog([], studyRooms).length, 9)
  assert.equal(mergeRoomCatalog([serverRoom, { ...studyRooms[1]!, id: '102', artworkId: 'room-2' }], studyRooms).length, 9)
})

test('only sample IDs are aligned to server IDs and dummy affection never replaces a server relationship', () => {
  const real = { ...createDummyState(now).records[0]!, dataSource: undefined, id: '9001', roomId: 'dawn-library', characterIds: ['chaerin'] }
  const snapshot = createDummyState(now)
  snapshot.records.push(real)
  const aligned = alignDummyState(snapshot, mergeRoomCatalog([serverRoom], studyRooms))
  assert.ok(aligned.records.some(r => r.roomId === '101' && r.characterIds.includes('201')))
  assert.equal(aligned.records.at(-1), real)
  assert.equal(aligned.affection?.sua, 50)
  assert.equal(aligned.affection?.['201'], undefined)
})

test('dummy wallet, pass and gifts survive reload and remain separate for each account', () => {
  const store = storage()
  let state = { ...emptyState(), ...createDummyState(now) }
  state = demoReducer(state, { type: 'PURCHASE', productId: 'charge-1000', method: '카드', now })
  state = demoReducer(state, { type: 'PURCHASE', productId: 'character-pass', method: '카드', now: now + 1 })
  state = demoReducer(state, { type: 'GIFT', productId: 'coffee', characterId: 'sua', characterName: '수아', now: now + 2 })
  assert.equal(writeDummyState(store, 1, state), true)
  const restored = readDummyState(store, 1, now)
  assert.equal(restored.credits, 5800)
  assert.equal(restored.pass?.name, '친구 패스')
  assert.equal(restored.gifts[0]!.characterId, 'sua')
  assert.equal(readDummyState(store, 2, now).credits, 5000)
  assert.equal(readDummyState(store, 2, now).gifts.length, 0)
  assert.equal('profile' in JSON.parse(store.getItem(dummyStorageKey(1))!), false)
  assert.equal('memories' in dummySnapshot(state), false)
  removeAccountSnapshots(store, 1)
  assert.equal(store.getItem(dummyStorageKey(1)), null)
})

test('corrupt saves and denied storage fall back to usable fixtures without trusting a saved identity', () => {
  const store = storage()
  store.setItem(dummyStorageKey(1), '{')
  assert.equal(readDummyState(store, 1, now).credits, 5000)
  store.setItem(dummyStorageKey(1), JSON.stringify({ credits: -100, profile: { loggedIn: true } }))
  assert.equal(readDummyState(store, 1, now).credits, 5000)
  assert.equal(writeDummyState({ setItem: () => { throw new Error('denied') } }, 1, emptyState()), false)
})

test('a saved group study pauses during offline time, resumes with its tier and goal, and settles once', () => {
  const store = storage()
  let state = demoReducer({ ...emptyState(), ...createDummyState(now) }, {
    type: 'START', now, roomId: 'dawn-library', characterIds: ['chaerin', 'sua', 'dahee'], targetMinutes: 25, tier: 'premium', camera: false,
  })
  state = demoReducer(state, { type: 'PAUSE_SESSION', now: now + 120000 })
  writeDummyState(store, 1, state)
  const restored = readDummyState(store, 1, now + 86400000)
  assert.equal(restored.activeSession?.elapsedMs, 120000)
  assert.equal(restored.activeSession?.runningSince, null)
  assert.equal(restored.activeSession?.targetSeconds, 1500)
  assert.equal(restored.activeSession?.tier, 'premium')
  assert.deepEqual(restored.activeSession?.characterIds, ['chaerin', 'sua', 'dahee'])
  const finished = finishDummySession({ ...state, ...restored }, now + 86400000, { studySeconds: 120, presentSeconds: 110 })
  assert.equal(finished.records[0]!.dataSource, 'dummy')
  assert.equal(finished.records[0]!.focusSeconds, 110)
  assert.equal(finished.records[0]!.awaySeconds, 10)
  assert.equal(finished.records[0]!.targetSeconds, 1500)
  assert.equal(finished.credits, 4500)
  assert.equal(finishDummySession(finished, now, { studySeconds: 120, presentSeconds: 110 }), finished)
  const server = { ...state, activeSession: { ...state.activeSession!, id: '9001', serverSession: true } }
  writeDummyState(store, 1, server)
  assert.equal(readDummyState(store, 1, now).activeSession, null)
})
