import assert from 'node:assert/strict'
import test from 'node:test'
import type { MyMatesResponse, RecordsResponse } from '../src/shared/api/types.ts'
import { myMates, records } from '../src/features/backend/records-adapters.ts'
import { capsulesFromConnections } from '../src/features/mates/my-mates-source.ts'
import { boardRecords, connectionRecord, type RecordsMate } from '../src/features/records/records-source.ts'
import { connectionDayKey } from '../src/features/records/connection-day.ts'
import { isCurrentServerData, resolveServerData } from '../src/features/backend/server-data.ts'
import { VoicePlayer, type VoiceContext } from '../src/features/mates/voice-player.ts'
import { voiceMayPlayNow, voiceRequested } from '../src/features/mates/voice-reply.ts'
import { ENGINE_SOURCES, parseEngineSources } from '../src/features/mate-render/mate-source.ts'
import { CAPSULE_RECORD_COPY, recordAmount, recordStageLine } from '../src/features/reports/capsule-record.ts'

// Review of main 590ce6e (Codex Major 1–3, Minor 4–5; UX [4-3]). Each test first reproduced the defect.

const chaerin: RecordsMate = { id: 'chaerin', characterId: '4', name: '채린', serverIds: [4] }
const seoul = (text: string) => Date.parse(`${text}+09:00`)
const iso = (time: number) => new Date(time).toISOString()

/**
 * A connection that started at 04:30 (the 11-24 business day: days run from 05:00), was cut off for 40 minutes and
 * ended at 05:50 with 2400 s connected. The server puts its 2400 s on 11-24. Its end minus its connected time is 05:10,
 * which is 11-25 — the day the old code counted it on, on top of the 11-24 bucket.
 */
const boundaryWeek = (recent: RecordsResponse['recent']): RecordsResponse => ({
  from: '2026-11-23', to: '2026-11-29', totalPresentSeconds: 0, totalConnectedSeconds: 2400, connectedDays: 1, connectionCount: 1,
  buckets: ['23', '24', '25', '26', '27', '28', '29'].map(day => ({ key: `2026-11-${day}`, presentSeconds: 0, connectedSeconds: day === '24' ? 2400 : 0 })),
  mates: [{ mateId: 4, name: '채린', presentSeconds: 0, connectedSeconds: 2400, connectionCount: 1, stage: 3 }],
  recent,
})
const boundaryRecent = { connectionId: 301, mateId: 4, mateName: '채린', endedAt: iso(seoul('2026-11-25T05:50:00')), presentSeconds: 0, connectedSeconds: 2400 }
const total = (items: readonly { studySeconds: number }[]) => items.reduce((sum, item) => sum + item.studySeconds, 0)
const byDay = (items: readonly Parameters<typeof connectionDayKey>[0][] & readonly { studySeconds: number }[]) => {
  const days = new Map<string, number>()
  for (const item of items) days.set(connectionDayKey(item), (days.get(connectionDayKey(item)) ?? 0) + item.studySeconds)
  return Object.fromEntries([...days].filter(([, seconds]) => seconds > 0))
}

test('Major 1: the 05:00 boundary never counts a connection twice — the day totals are the server buckets', () => {
  const view = records(boundaryWeek([boundaryRecent]))
  const recent = view.recent.map(connection => connectionRecord(connection, chaerin))
  const board = boardRecords([{ mate: chaerin, view }], recent)
  assert.equal(total(board), 2400, 'the server said 2400 s, not 4800')
  assert.deepEqual(byDay(board), { '2026-11-24': 2400 }, 'on the day the server put it')
})

test('Major 1: a real `startedAt` from the server (optional field) places the connection itself on its day', () => {
  const view = records(boundaryWeek([{ ...boundaryRecent, startedAt: iso(seoul('2026-11-25T04:30:00')) }]))
  assert.equal(view.recent[0]!.startedAt, seoul('2026-11-25T04:30:00'))
  const board = boardRecords([{ mate: chaerin, view }], view.recent.map(connection => connectionRecord(connection, chaerin)))
  assert.deepEqual(board.map(item => [item.id, item.studySeconds, connectionDayKey(item)]), [['301', 2400, '2026-11-24']], 'the real connection, no day record beside it')
  // A malformed or impossible start is ignored (the estimate stays), never fatal.
  assert.equal(records(boundaryWeek([{ ...boundaryRecent, startedAt: 'soon' }])).recent[0]!.startedAt, undefined)
  assert.equal(records(boundaryWeek([{ ...boundaryRecent, startedAt: iso(seoul('2026-11-25T06:00:00')) }])).recent[0]!.startedAt, undefined)
})

test('Major 1 · UX [6-3]: the board adds up to the buckets — connections outside them never add time', () => {
  const seojin: RecordsMate = { id: 'seojin', characterId: '2', name: '서진', serverIds: [2] }
  const view = records({
    ...boundaryWeek([]),
    buckets: boundaryWeek([]).buckets!.map(bucket => bucket.key === '2026-11-26' ? { ...bucket, connectedSeconds: 3000 } : bucket),
    recent: [
      // Fits its day: shown as itself.
      { connectionId: 401, mateId: 4, mateName: '채린', endedAt: iso(seoul('2026-11-26T21:00:00')), presentSeconds: 0, connectedSeconds: 1800 },
      // Started in the week before (the server counted it there): no bucket of this range holds it.
      { connectionId: 402, mateId: 4, mateName: '채린', endedAt: iso(seoul('2026-11-23T05:20:00')), presentSeconds: 0, connectedSeconds: 1800 },
      // Another mate's connection on a day this mate's buckets do not cover.
      { connectionId: 403, mateId: 2, mateName: '서진', endedAt: iso(seoul('2026-11-27T21:00:00')), presentSeconds: 0, connectedSeconds: 600 },
    ],
  })
  const recent = view.recent.map(connection => connectionRecord(connection, connection.mateId === 2 ? seojin : chaerin))
  const board = boardRecords([{ mate: chaerin, view }], recent)
  const buckets = view.buckets.reduce((sum, bucket) => sum + bucket.connectedSeconds, 0)
  assert.equal(total(board), buckets)
  assert.deepEqual(byDay(board), { '2026-11-24': 2400, '2026-11-26': 3000 })
  assert.ok(board.some(item => item.id === '401'), 'the fitting one stays a real connection (it opens its record card)')
})

test('Major 1: my-mates capsules take the server start when it is sent', () => {
  const dto: MyMatesResponse = { mates: [{
    id: 4, name: '채린', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 2400, lastConnectedAt: boundaryRecent.endedAt, firstMetAt: boundaryRecent.endedAt,
    recent: [{ connectionId: 301, endedAt: boundaryRecent.endedAt, presentSeconds: 0, connectedSeconds: 2400, startedAt: iso(seoul('2026-11-25T04:30:00')) }],
  }] }
  const [capsule] = capsulesFromConnections(myMates(dto)[0]!.recent)
  assert.equal(capsule!.startedAt, seoul('2026-11-25T04:30:00'))
  assert.equal(capsule!.endedAt, seoul('2026-11-25T05:50:00'))
})

test('Major 2: data of another filter is kept for the screen but never counts as the current filter', () => {
  const last = { scope: '7', key: 'week|all', data: { total: 100 } }
  // The new filter is loading: the last data stays (dimmed) but belongs to the old key.
  const loading = resolveServerData({ key: 'week|seojin', token: 'week|seojin#0', state: { token: 'week|all#0', value: { status: 'ready', data: { total: 100 }, error: null } }, last, scope: '7' })
  assert.equal(loading.status, 'loading')
  assert.deepEqual(loading.data, { total: 100 })
  assert.equal(isCurrentServerData(loading, 'week|seojin'), false)
  // The new filter failed: the error shows, the last data is still the old key's.
  const failed = resolveServerData({ key: 'week|seojin', token: 'week|seojin#0', state: { token: 'week|seojin#0', value: { status: 'error', data: null, error: 'x' } }, last, scope: '7' })
  assert.equal(failed.status, 'error')
  assert.equal(isCurrentServerData(failed, 'week|seojin'), false)
  // A retry of the same key that fails keeps the same key's data current.
  const retried = resolveServerData({ key: 'week|all', token: 'week|all#1', state: { token: 'week|all#1', value: { status: 'error', data: null, error: 'x' } }, last, scope: '7' })
  assert.equal(isCurrentServerData(retried, 'week|all'), true)
  // Ready for the key: current.
  const ready = resolveServerData({ key: 'week|seojin', token: 'week|seojin#0', state: { token: 'week|seojin#0', value: { status: 'ready', data: { total: 5 }, error: null } }, last: { scope: '7', key: 'week|seojin', data: { total: 5 } }, scope: '7' })
  assert.equal(isCurrentServerData(ready, 'week|seojin'), true)
  // Another account never sees it.
  assert.equal(resolveServerData({ key: 'week|all', token: 'week|all#0', state: { token: null, value: { status: 'loading', data: null, error: null } }, last, scope: '8' }).data, null)
})

/** Web Audio stand-in for creating the context and its graph. */
function context(overrides: Partial<Record<'createAnalyser' | 'createGain', () => never>> = {}): VoiceContext {
  const node = { connect() {}, disconnect() {} }
  return {
    currentTime: 0, state: 'suspended', destination: {},
    resume: async () => {}, close: async () => {},
    createGain: () => ({ ...node, gain: { value: 1 } }),
    createAnalyser: () => ({ ...node, fftSize: 0, getByteTimeDomainData() {} }),
    createBufferSource: () => { throw new Error('not here') },
    decodeAudioData: async () => ({ length: 0, sampleRate: 1000, duration: 0 }),
    ...overrides,
  } as VoiceContext
}

test('Major 3: voice is asked for only once the audio context and its graph really exist', () => {
  // The browser has AudioContext, but creating one fails (too many contexts, a policy, a broken device).
  const noContext = new VoicePlayer({ createContext: () => null })
  assert.equal(noContext.getAvailability(), 'pending')
  assert.equal(noContext.prepare(), false)
  assert.equal(noContext.getAvailability(), 'unavailable')
  assert.equal(voiceRequested({ voiceEnabled: true, practice: false, playable: noContext.getAvailability() === 'ready' }), false)
  // The context comes, the graph does not.
  const noGraph = new VoicePlayer({ createContext: () => context({ createAnalyser: () => { throw new Error('graph') } }) })
  assert.equal(noGraph.prepare(), false)
  assert.equal(noGraph.getAvailability(), 'unavailable')
  // All there: ready, and listeners hear the change.
  const ok = new VoicePlayer({ createContext: () => context() })
  let heard = 0
  ok.subscribe(() => { heard++ })
  assert.equal(ok.prepare(), true)
  assert.equal(ok.getAvailability(), 'ready')
  assert.ok(heard > 0)
  ok.release()
  assert.equal(ok.getAvailability(), 'pending', 'closed with the screen; the next screen prepares again')
  // No Web Audio at all.
  assert.equal(new VoicePlayer({ createContext: () => context(), supported: false }).prepare(), false)
})

test('Minor 4: a reaction voice asked before a stop is dropped; it plays only while the call still wants it', () => {
  const player = new VoicePlayer({ createContext: () => context() })
  const ticket = player.ticket()
  player.cut()
  assert.notEqual(player.ticket(), ticket, 'a cut (voice off, talking, hidden, call end) starts a new generation')
  let begun = 0
  const begin = player.begin.bind(player)
  player.begin = () => { begun++; return begin() }
  player.play('AAAA', ticket)
  assert.equal(begun, 0, 'the old request\'s audio never starts')
  player.play('AAAA', player.ticket())
  assert.equal(begun, 1)
  const now = { voiceOn: true, listening: false, hidden: false, pipOpen: false, callLive: true }
  assert.equal(voiceMayPlayNow(now), true)
  assert.equal(voiceMayPlayNow({ ...now, voiceOn: false }), false)
  assert.equal(voiceMayPlayNow({ ...now, listening: true }), false)
  assert.equal(voiceMayPlayNow({ ...now, hidden: true }), false)
  assert.equal(voiceMayPlayNow({ ...now, hidden: true, pipOpen: true }), true)
  assert.equal(voiceMayPlayNow({ ...now, callLive: false }), false)
})

test('Minor 5: VITE_ENGINE_ALLOWLIST refuses dot segments in the written path, before the URL parser removes them', () => {
  for (const raw of [
    'https://cdn.example/engines/../other/',
    'https://cdn.example/engines/./',
    'https://cdn.example/a/b/../../',
    'https://cdn.example/engines/.%2e/other/',
    'https://cdn.example/engines/%2E/',
  ]) assert.deepEqual(parseEngineSources(raw), ENGINE_SOURCES, raw)
  // Dots inside a name are fine.
  assert.deepEqual(parseEngineSources('https://cdn.example/v1.2/engines/'), [{ origin: 'https://cdn.example', pathPrefix: '/v1.2/engines/' }])
  assert.deepEqual(parseEngineSources('https://cdn.example/.well/'), [{ origin: 'https://cdn.example', pathPrefix: '/.well/' }])
})

test('UX [4-3]: the record summary is one plain sentence; the stage shows an arrow only when it changed', () => {
  const amount = recordAmount(23 * 60)
  const line = `${CAPSULE_RECORD_COPY.summaryBefore}${amount.value}${amount.unit}${CAPSULE_RECORD_COPY.summaryAfter}`
  assert.equal(line, '23분 동안 같이 있었어요.')
  assert.ok(!line.includes(CAPSULE_RECORD_COPY.title.slice(-5)), 'not the title\'s 「함께했어요」 again')
  assert.deepEqual(recordStageLine({ current: '친구' }), { previous: null, current: '친구' })
  assert.deepEqual(recordStageLine({ previous: '친구', current: '친구' }), { previous: null, current: '친구' })
  assert.deepEqual(recordStageLine({ previous: '아는 사이', current: '친구' }), { previous: '아는 사이', current: '친구' })
  assert.equal(recordStageLine({ previous: '친구' }), null)
})
