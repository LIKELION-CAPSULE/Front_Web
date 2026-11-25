import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ApiError } from '../src/shared/api/client.ts'
import type { LoginMatesResponse, MyMate, RecordsResponse } from '../src/shared/api/types.ts'
import { createCountGate, inAppLink } from '../src/features/notifications/notifications.ts'
import { mergeRecords, myMate, records } from '../src/features/backend/records-adapters.ts'
import { collectRecordsFacts, classifyPeriod, chaerinVoice, dohyunVoice, mateCommentFromFacts, timeBandLabels } from '../src/features/records/mate-comment.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import { connectBlockedMessage, withComingSoon, type AvailableMate } from '../src/features/mates/catalog.ts'
import { resolveMateSource } from '../src/features/mate-render/mate-source.ts'
import { warmKey } from '../src/features/mate-render/warm-renderer.ts'

// Codex review of API wiring (stage 1 · 2): one reproduction per finding (4–11; 1–3 are in api-wire-2.test.ts).

// ── 4 ──
test('[review 4] the unread count: a 43 read sent before a 44 result cannot put the old count back when it lands after', () => {
  const gate = createCountGate()
  const read43 = gate.next() // GET /notifications (count 5) sent
  const read44 = gate.next() // POST /notifications/read sent (→ 0)
  assert.equal(gate.accept(read44), true, '44 answers first: 0')
  assert.equal(gate.accept(read43), false, 'the older 43 (5) is dropped')
  const later = gate.next()
  assert.equal(gate.accept(later), true, 'a 43 sent after it counts')
  // Two reads answering out of order: the newer one stays.
  const a = gate.next(), b = gate.next()
  assert.equal(gate.accept(b), true); assert.equal(gate.accept(a), false)
})

// ── 5 ──
const week = (patch: Partial<RecordsResponse>): RecordsResponse => ({
  from: '2026-11-23', to: '2026-11-29', totalPresentSeconds: 0, totalConnectedSeconds: 0, connectedDays: 0, connectionCount: 0,
  buckets: ['23', '24', '25', '26', '27', '28', '29'].map(day => ({ key: `2026-11-${day}`, presentSeconds: 0, connectedSeconds: 0 })), mates: [], recent: [], ...patch,
})
const withDays = (seconds: Record<string, number>) => ['23', '24', '25', '26', '27', '28', '29'].map(day => ({ key: `2026-11-${day}`, presentSeconds: 0, connectedSeconds: seconds[day] ?? 0 }))

test('[review 5] one persona’s two ids in the same week: a day with both counts once; different months still add up', () => {
  // id 2: Mon + Tue; id 3: Tue + Wed → 3 days, not 4.
  const id2 = records(week({ connectedDays: 2, connectionCount: 2, totalConnectedSeconds: 2400, buckets: withDays({ 23: 1200, 24: 1200 }) }))
  const id3 = records(week({ connectedDays: 2, connectionCount: 2, totalConnectedSeconds: 2400, buckets: withDays({ 24: 600, 25: 1800 }) }))
  const same = mergeRecords([id2, id3], { samePeriod: true })
  assert.equal(same.connectedDays, 3)
  assert.equal(same.connectionCount, 4); assert.equal(same.totalConnectedSeconds, 4800)
  assert.equal(same.buckets.find(item => item.key === '2026-11-24')!.connectedSeconds, 1800)
  // Never fewer days than one id says (a day may hold time the buckets round away).
  const odd = records(week({ connectedDays: 4, connectionCount: 4, totalConnectedSeconds: 60, buckets: withDays({ 23: 60 }) }))
  assert.equal(mergeRecords([odd, id3], { samePeriod: true }).connectedDays, 4)
  // Months of a year: no day is in two parts, the days add up.
  const october = records({ ...week({}), from: '2026-10-01', to: '2026-10-31', connectedDays: 5, buckets: [{ key: '2026-10-02', presentSeconds: 0, connectedSeconds: 60 }] })
  const november = records({ ...week({}), from: '2026-11-01', to: '2026-11-30', connectedDays: 7, buckets: [{ key: '2026-11-02', presentSeconds: 0, connectedSeconds: 60 }] })
  assert.equal(mergeRecords([october, november]).connectedDays, 12)
})

// ── 6 ──
const NOW = Date.parse('2026-11-27T15:00:00+09:00') // Friday
const thisWeek = getRecordRange('week', NOW - 5 * 3_600_000, 0)
const lastWeek = getRecordRange('week', NOW - 5 * 3_600_000, -1)
const lines = (facts: ReturnType<typeof collectRecordsFacts>) => {
  const kind = classifyPeriod(facts)
  if (!kind) return { kind, texts: [] as string[] }
  const texts = [chaerinVoice, dohyunVoice].flatMap(voice => voice.templates[kind].map(template => template({
    ...facts, periodTopic: '', total: '', longestDuration: '', tense: (present: string) => present,
  })).filter(Boolean).map(line => (typeof line === 'string' ? line : line!.text)))
  return { kind, texts }
}

test('[review 6] the records comment speaks from 38 sums: a day bucket is not one connection, unknown facts make no line', () => {
  // Three connections on one day, joined in one day bucket of 2.5 hours (no single connection lasted that long).
  const view = { connectionCount: 3, connectedDays: 1, totalConnectedSeconds: 9000, buckets: [{ key: '2026-11-25', connectedSeconds: 9000 }] }
  const facts = collectRecordsFacts({ range: thisWeek, offset: 0, view, met: true, firstMetAt: Date.parse('2026-10-01T12:00:00+09:00') })
  assert.equal(facts.sessions, 3, '38 connectionCount, not the number of buckets')
  assert.equal(facts.activeDays, 1); assert.equal(facts.totalSeconds, 9000)
  assert.equal(facts.longest, null); assert.equal(facts.longSessions, 0, 'the day bucket is not a 2.5-hour connection')
  assert.equal(facts.lateSessions, 0); assert.equal(facts.dominantBand, null)
  assert.equal(facts.previousSessions, null, '38 reads this range only')
  assert.equal(facts.lastSeenDaysAgo, null)
  const { kind, texts } = lines(facts)
  assert.notEqual(kind, 'long'); assert.notEqual(kind, 'late'); assert.notEqual(kind, 'more'); assert.notEqual(kind, 'less')
  for (const text of texts) {
    for (const band of Object.values(timeBandLabels)) assert.ok(!text.includes(`${band}에`), `no time of day: ${text}`)
    assert.ok(!/제일 길었던|지난주|저번/.test(text), `no longest or previous period: ${text}`)
  }
  const comment = mateCommentFromFacts(facts, { range: thisWeek, seedKey: 'u|4' })
  assert.ok(comment)
  assert.deepEqual(comment!.highlight.days.every(day => day === '2026-11-25'), true)
})

test('[review 6] first meeting, missed and streaks come from 37 firstMetAt and the day buckets only', () => {
  // First met this week (37): 「처음 만났지」 lines are true.
  const first = collectRecordsFacts({ range: thisWeek, offset: 0, view: { connectionCount: 2, connectedDays: 2, totalConnectedSeconds: 3600, buckets: [{ key: '2026-11-24', connectedSeconds: 1800 }, { key: '2026-11-25', connectedSeconds: 1800 }] }, met: true, firstMetAt: Date.parse('2026-11-24T20:00:00+09:00') })
  assert.equal(first.isFirstPeriod, true); assert.equal(classifyPeriod(first), 'firstPeriod')
  // Met before, nothing this week: missed (no 「N일 전」 line: the last meeting is not known here).
  const missed = collectRecordsFacts({ range: thisWeek, offset: 0, view: null, met: true, firstMetAt: Date.parse('2026-10-01T12:00:00+09:00') })
  assert.equal(classifyPeriod(missed), 'missed')
  assert.ok(lines(missed).texts.every(text => !/전이야|째 안 보이/.test(text)))
  // Never met: first meet.
  assert.equal(classifyPeriod(collectRecordsFacts({ range: thisWeek, offset: 0, view: null, met: false, firstMetAt: null })), 'firstMeet')
  // A streak from the week's first day may have begun the week before: not counted…
  const fromMonday = collectRecordsFacts({ range: thisWeek, offset: 0, view: { connectionCount: 5, connectedDays: 5, totalConnectedSeconds: 5000, buckets: ['23', '24', '25', '26', '27'].map(day => ({ key: `2026-11-${day}`, connectedSeconds: 1000 })) }, met: true, firstMetAt: Date.parse('2026-10-01T12:00:00+09:00') })
  assert.equal(fromMonday.streakDays, 0)
  // …unless they first met on its first day; a streak after a day without time in the range is known.
  assert.equal(collectRecordsFacts({ range: thisWeek, offset: 0, view: { connectionCount: 5, connectedDays: 5, totalConnectedSeconds: 5000, buckets: ['23', '24', '25', '26', '27'].map(day => ({ key: `2026-11-${day}`, connectedSeconds: 1000 })) }, met: true, firstMetAt: Date.parse('2026-11-23T12:00:00+09:00') }).streakDays, 5)
  assert.equal(collectRecordsFacts({ range: thisWeek, offset: 0, view: { connectionCount: 3, connectedDays: 3, totalConnectedSeconds: 3000, buckets: ['25', '26', '27'].map(day => ({ key: `2026-11-${day}`, connectedSeconds: 1000 })) }, met: true, firstMetAt: Date.parse('2026-10-01T12:00:00+09:00') }).streakDays, 3)
  // A past week: no comment when empty.
  assert.equal(classifyPeriod(collectRecordsFacts({ range: lastWeek, offset: -1, view: null, met: true, firstMetAt: Date.parse('2026-10-01T12:00:00+09:00') })), null)
})

// ── 8 ──
test('[review 8] 48 `format` reaches the login stage: a v2 model whose URL is not …/model.json still resolves live', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  try {
    const { loginV2ModelsFromServer } = await server.ssrLoadModule('/src/features/auth/login-backgrounds/desktop/login-mate-source.ts')
    const response: LoginMatesResponse = { mates: [{ id: 4, name: '채린', ageRating: 'ALL', cardImageUrl: null, model: { format: 'ALIVING2D_V2', modelJsonUrl: 'https://cdn.example/chaerin/v5/chaerin.json', engineUrl: 'https://cdn.example/engine.js', playerUrl: 'https://cdn.example/player.js' } }] }
    const config = loginV2ModelsFromServer(response).chaerin
    assert.equal(config.format, 'ALIVING2D_V2')
    // Engine scripts served from the page's own origin pass the allowlist here; the format is what decides the kind.
    const options = { pageOrigin: 'https://cdn.example' }
    const input = { modelUrl: config.modelJsonUrl, engineUrl: config.engineUrl, playerUrl: config.playerUrl, reactionsUrl: config.reactionsUrl }
    assert.equal(resolveMateSource(input, options).kind, 'static', 'without the format: the still (the bug)')
    assert.equal(resolveMateSource({ ...input, format: config.format }, options).kind, 'aliving')
    // A plain …/model.json: the same source (and warm hand-off key) with or without the format.
    const plain = { modelUrl: 'https://cdn.example/chaerin/v5/model.json', engineUrl: 'https://cdn.example/engine.js', playerUrl: 'https://cdn.example/player.js' }
    const a = resolveMateSource(plain, { pageOrigin: 'https://cdn.example' }), b = resolveMateSource({ ...plain, format: 'ALIVING2D_V2' }, { pageOrigin: 'https://cdn.example' })
    assert.equal(a.kind, 'aliving'); assert.equal(b.kind, 'aliving')
    if (a.kind === 'aliving' && b.kind === 'aliving') assert.equal(warmKey(a), warmKey(b))
  } finally { await server.close() }
})

// ── 9 ──
test('[review 9] notification links are checked again after normalising: dot segments (also encoded) cannot make //host', () => {
  for (const link of ['/.//evil.example/x', '/a/..//evil.example', '/%2e//evil.example', '/%2e%2e//evil.example', '/%2E%2E/%2E%2E//evil.example', '/./\\evil.example', '/.%2F/evil.example']) {
    const result = inAppLink(link)
    assert.ok(result === null || (result.startsWith('/') && !result.startsWith('//')), `${link} → ${result}`)
  }
  assert.equal(inAppLink('/%2e%2e//evil.example'), null)
  assert.equal(inAppLink('/credits/../mates/me'), '/mates/me')
  assert.equal(inAppLink('/%2e/records'), '/records')
})

// ── 10 ──
test('[review 10] the detail page’s comingSoon (31) is what the connect action uses; a blocked connect says why', () => {
  const card = { id: 'dohyun', characterId: '2', name: '서도현', comingSoon: true } as AvailableMate
  const opened = withComingSoon(card, false)
  assert.equal(opened.comingSoon, false); assert.equal(connectBlockedMessage(opened), null)
  assert.equal(withComingSoon(card, true), card, 'same value: the same object')
  assert.equal(connectBlockedMessage(withComingSoon({ ...card, comingSoon: false }, true)), '아직 준비 중인 메이트예요.')
})

// ── 11 ──
test('[review 11] optional lists that come as null are empty; the core fields are still checked', () => {
  const mate: MyMate = { id: 4, name: '채린', firstMetAt: '2026-11-01T01:00:00Z', lastConnectedAt: '2026-11-25T01:00:00Z', connectionCount: 1, totalPresentSeconds: 0, totalConnectedSeconds: 60, relation: null, unlocks: null, recent: null } as unknown as MyMate
  const view = myMate(mate)
  assert.deepEqual(view.unlocks, []); assert.deepEqual(view.recent, [])
  assert.throws(() => myMate({ ...mate, unlocks: 'x' } as unknown as MyMate), (error: unknown) => error instanceof ApiError && error.status === 502)
  assert.throws(() => myMate({ ...mate, id: 0 } as unknown as MyMate), (error: unknown) => error instanceof ApiError && error.status === 502)
  const range = records(week({ mates: null, recent: null } as unknown as Partial<RecordsResponse>))
  assert.deepEqual(range.mates, []); assert.deepEqual(range.recent, [])
  assert.throws(() => records(week({ buckets: null } as unknown as Partial<RecordsResponse>)), (error: unknown) => error instanceof ApiError && error.status === 502)
  assert.throws(() => records(week({ totalConnectedSeconds: -1 })), (error: unknown) => error instanceof ApiError && error.status === 502)
})
