import test from 'node:test'
import assert from 'node:assert/strict'
import { connectionBackground, emptyState, mateRoom, numericId, profile, report, session, settlement } from '../src/features/backend/adapters.ts'

const serverTime = '2026-11-05T03:00:02Z'
const startedAt = '2026-11-05T03:00:00Z'
const base = { connectionId: 512, mate: { id: 42, name: '채린' }, serverTime }

test('application initialization contains no sample accounts, schedules, credits or records', () => {
  const state = emptyState()
  assert.equal(state.profile.loggedIn, false)
  assert.equal(state.profile.name, '')
  assert.equal(state.credits, 0)
  for (const entries of [state.records, state.memories, state.ledger, state.messages, state.gifts]) assert.deepEqual(entries, [])
})

test('only safe positive integer server IDs are accepted', () => {
  assert.equal(numericId('512'), 512)
  for (const value of ['session-512', '../me', '0', '-1', '9007199254740992']) assert.throws(() => numericId(value))
})

test('profile uses the authenticated identity and rejects an incomplete response', () => {
  assert.equal(profile({ userId: 7, nickname: '서버 사용자', onboardingRequired: false }).name, '서버 사용자')
  assert.equal(profile({ userId: 7, nickname: 'n', onboardingRequired: true, profileImage: null }).profileImage, undefined)
  assert.throws(() => profile({ nickname: 'anonymous', onboardingRequired: false }))
})

test('a home mate card becomes a one-mate room keyed by the mate id', () => {
  const result = mateRoom({ id: 4, name: '채린', cardImageUrl: 'https://cdn.example/card.webp', hashtags: ['#공부'], comingSoon: false })
  assert.equal(result.id, '4')
  assert.equal(result.characters[0]?.id, '4')
  assert.equal(result.coverUrl, 'https://cdn.example/card.webp')
  assert.equal(result.contentStatus, 'preview')
  assert.equal(mateRoom({ id: 5, name: '서진', comingSoon: true }).contentStatus, 'coming-soon')
  assert.throws(() => mateRoom({ id: 0, name: 'x' }))
})

test('server time corrects a skewed local clock without a study goal', () => {
  const localNow = Date.parse('2026-11-05T02:55:02Z')
  const active = session({ ...base, startedAt }, localNow)
  assert.equal(active.id, '512')
  assert.equal(active.roomId, '42')
  assert.deepEqual(active.characterIds, ['42'])
  assert.equal(active.serverOffsetMs, 300_000)
  assert.equal(active.elapsedMs, 2000)
  assert.equal(active.startedAt, Date.parse('2026-11-05T02:55:00Z'))
  assert.equal(active.targetSeconds, undefined)
  assert.equal(active.initialTotals, undefined)
})

test('resume continues from the last heartbeat totals; malformed totals are refused, zeros accepted', () => {
  const active = session({ ...base, connectedSeconds: 120, presentSeconds: 90, cameraOnSeconds: 100, pipSeconds: 30 }, Date.parse(serverTime))
  assert.equal(active.studySeconds, 120)
  assert.equal(active.elapsedMs, 120_000)
  assert.deepEqual(active.initialTotals, { presentSeconds: 90, cameraOnSeconds: 100, pipSeconds: 30 })
  assert.equal(active.presenceKnown, true)
  assert.deepEqual(session({ ...base, connectedSeconds: 0, presentSeconds: 0, cameraOnSeconds: 0, pipSeconds: 0 }, Date.parse(serverTime)).initialTotals,
    { presentSeconds: 0, cameraOnSeconds: 0, pipSeconds: 0 }, 'a server that sends 0 is fine')
  const good = { ...base, connectedSeconds: 120, presentSeconds: 90, cameraOnSeconds: 100, pipSeconds: 30 }
  for (const bad of [
    { ...good, presentSeconds: undefined }, { ...good, cameraOnSeconds: '100' }, { ...good, pipSeconds: -1 }, { ...good, connectedSeconds: NaN },
    { ...good, presentSeconds: 101 }, { ...good, cameraOnSeconds: 121 }, { ...good, pipSeconds: 121 },
  ]) assert.throws(() => session(bad as never, Date.parse(serverTime)), { status: 502 }, JSON.stringify(bad))
  assert.throws(() => session({ connectionId: 512, serverTime }))
})

test('report values and closing line come from the server; the settlement view scales progress to 0–1', () => {
  const dto = { connectionId: 512, mate: { id: 42, name: '서진' }, startedAt, endedAt: serverTime, connectedSeconds: 2, presentSeconds: 1, awaySeconds: 1, returnCount: 0, messageCount: 3, closingLine: '서버 완료 대사',
    relation: { stageBefore: 2, stageAfter: 3, stageName: '친구', stageUp: true, nextStageSeconds: 3600, stageProgress: 40 } }
  const result = report(dto)
  assert.equal(result.id, '512')
  assert.equal(result.studySeconds, 2)
  assert.equal(result.focusSeconds, 1)
  assert.equal(result.characterName, '서도현', 'display mapping only')
  assert.equal(result.serverReport, dto)
  assert.equal(result.serverReport?.mate?.name, '서진')
  // A non-launch server mate keeps its own name: never shown as 채린.
  assert.equal(report({ ...dto, mate: { id: 1, name: '말포이' } }).characterName, '말포이')
  assert.deepEqual(settlement(dto.relation), { stage: 3, stageName: '친구', nextLevelSeconds: 3600, stageProgress: 0.4, levelUp: true })
  assert.deepEqual(settlement({ stage: 5, stageName: '단짝', nextStageName: null, nextStageSeconds: null, stageProgress: 100 }), { stage: 5, stageName: '단짝', stageProgress: 1 })
  assert.throws(() => report({ ...dto, mate: undefined }))
})

test('the connection background is the image of the current background code', () => {
  assert.equal(connectionBackground({ background: 'room', backgrounds: [{ code: 'park', imageUrl: '/p' }, { code: 'room', imageUrl: '/r' }] }), '/r')
  assert.equal(connectionBackground({ background: null, backgrounds: [] }), undefined)
})
