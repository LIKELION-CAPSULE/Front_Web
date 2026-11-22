import { emptyState } from '../backend/adapters.ts'
import { demoReducer, sessionElapsed } from '../demo/reducer.ts'
import { validState } from '../demo/persistence.ts'
import { createSampleRecords } from '../demo/sample-records.ts'
import type { DemoState } from '../demo/types.ts'
import type { StudyRoom } from '../rooms/types.ts'

export const dummyStorageKey = (userId: number) => `capsule-dummy:v1:${userId}`
type DummyState = Pick<DemoState, 'credits' | 'ledger' | 'pass' | 'gifts' | 'affection' | 'records' | 'activeSession' | 'messages' | 'chatUsage' | 'cameraBackground'>
export function dummySnapshot(state: DemoState): DummyState {
  const { credits, ledger, pass, gifts, affection, records, activeSession, messages, chatUsage, cameraBackground } = state
  return { credits, ledger, pass, gifts, affection, records, activeSession, messages, chatUsage, cameraBackground }
}

/** DUMMY_API:wallet — deliberately separate from authentication and server schedules. */
/** DUMMY_API:history — recent sample records, explicitly marked for replacement. */
export function createDummyState(now = Date.now()): DummyState {
  return {
    credits: 5000,
    ledger: [{ id: 'dummy-welcome', at: now, description: '체험용 크레딧 지급', kind: 'bonus', change: 5000, balance: 5000 }],
    pass: null, gifts: [], affection: {}, activeSession: null, messages: [], chatUsage: { day: '', used: 0 },
    records: createSampleRecords(now).filter(record => record.endedAt >= now - 30 * 86400000).map(record => ({ ...record, dataSource: 'dummy' })),
  }
}

export function readDummyState(storage: Pick<Storage, 'getItem'>, userId: number, now = Date.now()): DummyState {
  try {
    const value: unknown = JSON.parse(storage.getItem(dummyStorageKey(userId)) ?? 'null')
    if (!value || typeof value !== 'object') return createDummyState(now)
    const candidate = { ...emptyState(), ...value }
    if (!validState(candidate)) return createDummyState(now)
    const snapshot = dummySnapshot(candidate)
    const active = snapshot.activeSession
    // Server sessions always recover through /resume. Freeze local sessions so offline time never becomes study time.
    snapshot.activeSession = active && !active.serverSession
      ? { ...active, elapsedMs: sessionElapsed(active, now) * 1000, runningSince: null }
      : null
    if (snapshot.activeSession) {
      try {
        const presence = JSON.parse(storage.getItem(`capsule-presence:${userId}:${snapshot.activeSession.id}`) ?? 'null') as { studySeconds?: number; presentSeconds?: number } | null
        if (presence && typeof presence.studySeconds === 'number' && typeof presence.presentSeconds === 'number' && Number.isFinite(presence.studySeconds) && Number.isFinite(presence.presentSeconds)) {
          snapshot.activeSession.initialAwaySeconds = Math.max(0, presence.studySeconds - presence.presentSeconds)
        }
      } catch { /* The camera focus measurement remains available. */ }
    }
    return snapshot
  } catch { return createDummyState(now) }
}

export function writeDummyState(storage: Pick<Storage, 'setItem'>, userId: number, state: DemoState) {
  try {
    const snapshot = dummySnapshot(state)
    const active = snapshot.activeSession
    if (active && !active.serverSession) snapshot.activeSession = { ...active, elapsedMs: sessionElapsed(active, Date.now()) * 1000, runningSince: null }
    storage.setItem(dummyStorageKey(userId), JSON.stringify(snapshot))
    return true
  }
  catch { return false }
}

/** Match sample IDs to canonical server IDs; never replace real report metrics with fixtures. */
export function alignDummyState(snapshot: DummyState, rooms: readonly StudyRoom[]): DummyState {
  // DUMMY_API:affection — only local friends receive a provisional score.
  const affection = { ...snapshot.affection }
  for (const room of rooms) for (const character of room.characters) {
    if (!character.serverCharacter && affection[character.id] === undefined) affection[character.id] = 50
  }
  const canonicalCharacterId = (id: string) => rooms.flatMap(room => room.characters).find(c => c.id === id || c.artworkId === id)?.id ?? id
  const active = snapshot.activeSession
  const activeRoom = active && rooms.find(room => room.id === active.roomId || room.artworkId === active.roomId)
  return {
    ...snapshot, affection,
    activeSession: active && activeRoom ? { ...active, roomId: activeRoom.id, characterIds: active.characterIds.map(canonicalCharacterId) } : active,
    gifts: snapshot.gifts.map(gift => ({ ...gift, characterId: canonicalCharacterId(gift.characterId) })),
    messages: snapshot.messages.map(message => ({ ...message, characterId: canonicalCharacterId(message.characterId) })),
    records: snapshot.records.map(record => {
      if (record.dataSource !== 'dummy') return record
      const room = rooms.find(room => room.id === record.roomId || room.artworkId === record.roomId)
      return room ? { ...record, roomId: room.id, characterIds: record.characterIds.map(id => room.characters.find(c => c.id === id || c.artworkId === id)?.id ?? id) } : record
    }),
  }
}

export function finishDummySession(state: DemoState, now: number, totals: { studySeconds: number; presentSeconds: number }): DemoState {
  const next = demoReducer(state, { type: 'FINISH', now })
  if (next === state) return state
  const record = next.records[0]!
  return { ...next, records: [{ ...record, dataSource: 'dummy', cameraFocus: state.activeSession?.focus,
    studySeconds: totals.studySeconds, focusSeconds: totals.presentSeconds,
    awaySeconds: Math.max(0, totals.studySeconds - totals.presentSeconds), observedSeconds: totals.studySeconds,
  }, ...next.records.slice(1)] }
}
