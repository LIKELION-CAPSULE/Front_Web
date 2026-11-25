import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
import { ApiError } from '../src/shared/api/client.ts'
import type { LoginMatesResponse, MateDetailResponse, MyMatesResponse, RecordsResponse } from '../src/shared/api/types.ts'
import { mergeMyMates, mergeRecords, myMates, records } from '../src/features/backend/records-adapters.ts'
import { mateDetailContent } from '../src/features/backend/server-ports.ts'
import { checkedMateDetail } from '../src/features/mates/mate-contract.ts'
import { availableMates, serverAgeRating } from '../src/features/mates/catalog.ts'
import { capsulesFromConnections, estimatedCapsuleCount, expressionUnlocks, myMatesByLaunchMate } from '../src/features/mates/my-mates-source.ts'
import { boardRecords, connectionRecord, isDayRecord, recordsRequests, recordsSummary, type RecordsMate } from '../src/features/records/records-source.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'

// Examples built from docs/BACKEND_API.md (11-25) 37 · 38 · 31 · 48 tables (the document has no JSON examples).

const myMatesExample: MyMatesResponse = {
  mates: [
    {
      id: 4, name: '채린', cardImageUrl: 'https://cdn.example/chaerin/card.webp',
      firstMetAt: '2026-11-13T10:00:00Z', lastConnectedAt: '2026-11-25T01:00:00Z',
      connectionCount: 8, totalPresentSeconds: 20000, totalConnectedSeconds: 31200,
      relation: { stage: 3, stageName: '친구', nextStageName: '친한 친구', nextStageSeconds: 5400, stageProgress: 62 },
      unlocks: [
        { id: 11, type: 'EXPRESSION', title: '수줍음', unlockStage: 2, unlockStageName: '아는 사이', expressionName: 'shy', assetUrl: null, unlocked: true },
        { id: 12, type: 'EXPRESSION', title: '웃음', unlockStage: 4, unlockStageName: '친한 친구', expressionName: 'laugh', assetUrl: null, unlocked: false },
        { id: 13, type: 'VOICE_LINE', title: '응원', unlockStage: 3, unlockStageName: '친구', expressionName: null, assetUrl: 'https://cdn.example/v.mp3', unlocked: true },
        { id: 14, type: 'STICKER', title: '모르는 종류', unlocked: true },
      ],
      recent: [
        { connectionId: 101, endedAt: '2026-11-25T01:00:00Z', presentSeconds: 2400, connectedSeconds: 3000 },
        { connectionId: 100, endedAt: '2026-11-24T12:00:00Z', presentSeconds: 0, connectedSeconds: 1200 },
      ],
    },
    // 서진 twice (production data): id 2 and 3.
    { id: 2, name: '서진', connectionCount: 2, totalPresentSeconds: 600, totalConnectedSeconds: 1800, lastConnectedAt: '2026-11-20T10:00:00Z', firstMetAt: '2026-11-18T10:00:00Z',
      relation: { stage: 1, stageName: '처음', nextStageName: '아는 사이', nextStageSeconds: 3000, stageProgress: 10 },
      recent: [{ connectionId: 90, endedAt: '2026-11-20T10:00:00Z', presentSeconds: 600, connectedSeconds: 900 }] },
    { id: 3, name: '서진', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 600, lastConnectedAt: '2026-11-22T10:00:00Z', firstMetAt: '2026-11-22T09:50:00Z',
      relation: { stage: 2, stageName: '아는 사이', stageProgress: 0 },
      recent: [{ connectionId: 95, endedAt: '2026-11-22T10:00:00Z', presentSeconds: 0, connectedSeconds: 600 }] },
  ],
}

test('37: parses mates, relation (0–1), unlocks (unknown types skipped) and recent (newest first)', () => {
  const [chaerin] = myMates(myMatesExample)
  assert.equal(chaerin!.name, '채린')
  assert.equal(chaerin!.connectionCount, 8)
  assert.equal(chaerin!.totalConnectedSeconds, 31200)
  assert.equal(chaerin!.firstMetAt, Date.parse('2026-11-13T10:00:00Z'))
  assert.deepEqual(chaerin!.relation, { stage: 3, stageName: '친구', nextStageName: '친한 친구', nextLevelSeconds: 5400, stageProgress: 0.62 })
  assert.deepEqual(chaerin!.unlocks.map(item => item.id), ['11', '12', '13'])
  assert.deepEqual(chaerin!.recent.map(item => item.connectionId), ['101', '100'])
  assert.deepEqual(myMates({ mates: [] }), [])
})

test('37: a missing required field fails the response (502); a missing optional one takes its default', () => {
  for (const broken of [
    {},
    { mates: [{ name: '채린', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 1 }] },
    { mates: [{ id: 4, connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 1 }] },
    { mates: [{ id: 4, name: '채린', totalPresentSeconds: 0, totalConnectedSeconds: 1 }] },
    { mates: [{ id: 4, name: '채린', connectionCount: 1, totalPresentSeconds: -1, totalConnectedSeconds: 1 }] },
    { mates: [{ id: 4, name: '채린', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 1, recent: [{ endedAt: '2026-11-25T01:00:00Z', connectedSeconds: 1 }] }] },
    { mates: [{ id: 4, name: '채린', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 1, unlocks: [{ id: 1, type: 'EXPRESSION', unlocked: true }] }] },
  ] as MyMatesResponse[]) {
    assert.throws(() => myMates(broken), (error: unknown) => error instanceof ApiError && error.status === 502, JSON.stringify(broken))
  }
  const [minimal] = myMates({ mates: [{ id: 4, name: '채린', connectionCount: 0, totalPresentSeconds: 0, totalConnectedSeconds: 0 }] })
  assert.deepEqual([minimal!.relation, minimal!.unlocks, minimal!.recent, minimal!.firstMetAt, minimal!.cardImageUrl], [null, [], [], null, null])
})

test('37: the two 서진 entries are one 서도현 (sums, widest dates, newest relation, merged recent)', () => {
  const mates = availableMates({ mates: [{ id: 4, name: '채린' }, { id: 2, name: '서진' }, { id: 3, name: '서진' }] })
  const byMate = myMatesByLaunchMate(myMates(myMatesExample), mates)
  assert.deepEqual([...byMate.keys()].sort(), ['chaerin', 'dohyun'])
  const dohyun = byMate.get('dohyun')!
  assert.deepEqual(dohyun.serverIds, [2, 3])
  assert.equal(dohyun.connectionCount, 3)
  assert.equal(dohyun.totalConnectedSeconds, 2400)
  assert.equal(dohyun.firstMetAt, Date.parse('2026-11-18T10:00:00Z'))
  assert.equal(dohyun.lastConnectedAt, Date.parse('2026-11-22T10:00:00Z'))
  assert.equal(dohyun.relation?.stageName, '아는 사이', 'the entry met most recently')
  assert.deepEqual(dohyun.recent.map(item => item.connectionId), ['95', '90'])
  assert.equal(mergeMyMates([dohyun]), dohyun)
})

test('37 → my-mates page: capsules from recent, an estimated capsule total, the expression tiles', () => {
  const chaerin = myMates(myMatesExample)[0]!
  const capsules = capsulesFromConnections(chaerin.recent)
  assert.deepEqual(capsules.map(item => item.id), ['100', '101'], 'oldest first')
  assert.equal(capsules[1]!.startedAt, Date.parse('2026-11-25T01:00:00Z') - 3000 * 1000)
  assert.equal(capsules[1]!.connectionId, '101')
  // 101: 50 min → 5, 100: 20 min → min 3; 6 older connections with 27000 s → max(6 × 3, 45) = 45.
  assert.equal(estimatedCapsuleCount(chaerin), 5 + 3 + 45)
  const tiles = expressionUnlocks(chaerin)!
  assert.deepEqual(tiles.map(tile => [tile.label, tile.expressionFile, tile.unlocked, tile.unlockStage]), [['수줍음', 'shy', true, 2], ['웃음', 'laugh', false, 4]])
  assert.equal(tiles[1]!.condition, '친한 친구 단계에서 열려요')
  assert.equal(expressionUnlocks(undefined), null)
})

const recordsExample: RecordsResponse = {
  from: '2026-11-23', to: '2026-11-29',
  totalPresentSeconds: 2400, totalConnectedSeconds: 7200, connectedDays: 2, connectionCount: 3,
  buckets: ['23', '24', '25', '26', '27', '28', '29'].map(day => ({ key: `2026-11-${day}`, presentSeconds: day === '24' ? 2400 : 0, connectedSeconds: day === '23' ? 3600 : day === '24' ? 3600 : 0 })),
  mates: [{ mateId: 4, name: '채린', presentSeconds: 2400, connectedSeconds: 7200, connectionCount: 3, stage: 3 }],
  recent: [
    { connectionId: 202, mateId: 4, mateName: '채린', endedAt: '2026-11-24T03:00:00Z', presentSeconds: 2400, connectedSeconds: 3000 },
    { connectionId: 201, mateId: 4, mateName: '채린', endedAt: '2026-11-23T03:00:00Z', presentSeconds: 0, connectedSeconds: 3600 },
  ],
}

test('38: parses sums, buckets, mates and recent; required fields fail with 502', () => {
  const view = records(recordsExample)
  assert.equal(view.connectionCount, 3)
  assert.equal(view.buckets.length, 7)
  assert.equal(view.mates[0]!.stage, 3)
  assert.deepEqual(view.recent.map(item => item.connectionId), ['202', '201'])
  assert.deepEqual(records({ ...recordsExample, mates: undefined, recent: undefined }).mates, [])
  for (const broken of [
    { ...recordsExample, from: '2026/11/23' },
    { ...recordsExample, totalConnectedSeconds: undefined },
    { ...recordsExample, connectedDays: 1.5 },
    { ...recordsExample, buckets: undefined },
    { ...recordsExample, buckets: [{ key: '23', presentSeconds: 0, connectedSeconds: 0 }] },
    { ...recordsExample, mates: [{ mateId: 4, presentSeconds: 0, connectedSeconds: 0, connectionCount: 0 }] },
    { ...recordsExample, recent: [{ connectionId: 1, endedAt: 'yesterday', connectedSeconds: 1, mateId: 4 }] },
    { ...recordsExample, recent: [{ connectionId: 1, endedAt: '2026-11-24T03:00:00Z', connectedSeconds: 1 }] },
  ] as RecordsResponse[]) {
    assert.throws(() => records(broken), (error: unknown) => error instanceof ApiError && error.status === 502)
  }
})

test('38: a year is read month by month (started months only) and merged; one persona read per id sums by key', () => {
  const year = getRecordRange('year', Date.parse('2026-11-25T12:00:00+09:00'))
  assert.deepEqual(recordsRequests(year).map(request => request.date), ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'])
  assert.deepEqual(recordsRequests(getRecordRange('week', Date.parse('2026-11-25T12:00:00+09:00'))), [{ range: 'WEEK', date: '2026-11-23' }])
  const a = records(recordsExample)
  const b = records({ ...recordsExample, recent: [], connectionCount: 1, connectedDays: 1, mates: [] })
  const merged = mergeRecords([a, b])
  assert.equal(merged.connectionCount, 4)
  assert.equal(merged.buckets.length, 7, 'same keys add up')
  assert.equal(merged.buckets.find(bucket => bucket.key === '2026-11-23')!.connectedSeconds, 7200)
})

test('38 → board: day records for older time, the newest connections real, day records never open a card', () => {
  const chaerin: RecordsMate = { id: 'chaerin', characterId: '4', name: '채린', serverIds: [4] }
  const view = records({
    ...recordsExample,
    buckets: [{ key: '2026-11-23', presentSeconds: 0, connectedSeconds: 3600 + 1800 }, { key: '2026-11-21', presentSeconds: 600, connectedSeconds: 1200 }],
  })
  const recent = view.recent.map(connection => connectionRecord(connection, chaerin))
  const board = boardRecords([{ mate: chaerin, view }], recent.filter(item => item.id === '201'))
  // 11-21: a day record; 11-23: the real 201 (3600 s) and the rest of that day (1800 s) as a day record.
  assert.deepEqual(board.map(item => [item.id, item.studySeconds]), [['day:chaerin:2026-11-21', 1200], ['201', 3600], ['day:chaerin:2026-11-23', 1800]])
  assert.equal(isDayRecord(board[0]!), true)
  assert.equal(isDayRecord(board[1]!), false)
  assert.equal(board[1]!.serverReport?.connectionId, 201)
  const summary = recordsSummary(records(recordsExample), getRecordRange('week', Date.parse('2026-11-25T12:00:00+09:00')), true, 1)
  assert.deepEqual([summary.primaryLabel, summary.primarySeconds, summary.cameraSeconds, summary.activeDays, summary.sessions], ['이번 주 함께한 시간', 7200, 2400, 2, 3])
})

test('31: ageRating, comingSoon and hasConversation reach the detail (checked); 11 · 31 ageRating mapping', () => {
  const dto: MateDetailResponse = {
    id: 2, name: '서진', oneLiner: '한 줄', ageRating: 'ALL', hashtags: ['#공부'], illustrationUrl: 'https://cdn.example/i.webp', voiceSampleUrl: null,
    world: '세계', myRole: '역할', intro: '인트로', model: null, comingSoon: true, hasConversation: false,
  }
  const detail = checkedMateDetail(mateDetailContent(dto, 2), 2)
  assert.equal(detail.ageRating, 'all')
  assert.equal(detail.comingSoon, true)
  assert.equal(detail.hasConversation, false)
  assert.equal(detail.model, undefined)
  assert.equal(checkedMateDetail(mateDetailContent({ ...dto, ageRating: 'ADULT' }, 2), 2).ageRating, 'adult')
  assert.throws(() => mateDetailContent({ ...dto, id: 3 }, 2), (error: unknown) => error instanceof ApiError && error.status === 502)
  assert.throws(() => checkedMateDetail({ characterId: 2, comingSoon: 'yes' as unknown as boolean }, 2), (error: unknown) => error instanceof ApiError)
  assert.deepEqual([serverAgeRating('ALL'), serverAgeRating('ADULT'), serverAgeRating('15'), serverAgeRating(undefined)], ['all', 'adult', undefined, undefined])
  const [dohyun] = availableMates({ mates: [{ id: 2, name: '서진', ageRating: 'ADULT', comingSoon: true }] })
  assert.equal(dohyun!.ageRating, 'adult', 'the server value is shown (report: 서도현 is 전연령 by decision)')
  assert.equal(dohyun!.comingSoon, true)
})

test('48: the login 채린 takes her own server entry (not 「말포이」), a usable v2 model only, falls back otherwise', async () => {
  // The module uses the `@/` alias and asset imports: load it through Vite like the app does.
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  try {
  const { loginMateWithServer } = await server.ssrLoadModule('/src/features/auth/login-backgrounds/desktop/login-mate-source.ts')
  const base = { id: 'chaerin', name: '채린', ageRating: '전연령', portraitImage: 'bundled.webp', callBackgroundImage: null, model: null, v2Model: null, expressions: {} as never, bubblePosition: { align: 'center', bottomPx: 0, maxWidthPercent: 100 } } as const
  const production: LoginMatesResponse = { mates: [
    { id: 1, name: '말포이', ageRating: 'ALL', cardImageUrl: null, model: { format: 'CUBISM', modelJsonUrl: 'https://cdn/chaerin/v3/chaerin.model3.json' } },
    { id: 4, name: '채린', ageRating: 'ALL', cardImageUrl: 'https://cdn/chaerin/card.webp', model: { format: 'ALIVING2D_V2', modelJsonUrl: 'https://cdn/chaerin/v5/model.json', engineUrl: null } },
  ] }
  const mate = loginMateWithServer(base, production)
  assert.equal(mate.portraitImage, 'https://cdn/chaerin/card.webp')
  assert.equal(mate.v2Model, null, 'no engine URL: the stills stay')
  assert.equal(loginMateWithServer(base, { mates: [] }), base)
  assert.equal(loginMateWithServer(base, null), base)
  // A usable model (engine URL) replaces the default; the warm hand-off key is built from these same URLs.
  const withEngine = loginMateWithServer(base, { mates: [{ ...production.mates![1]!, model: { ...production.mates![1]!.model!, engineUrl: 'https://cdn/engine.js', playerUrl: 'https://cdn/player.js' } }] })
  assert.deepEqual(withEngine.v2Model, { modelJsonUrl: 'https://cdn/chaerin/v5/model.json', engineUrl: 'https://cdn/engine.js', playerUrl: 'https://cdn/player.js' })
  } finally { await server.close() }
})
