import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyState, numericId, profile, memory, room, session, report } from '../src/features/backend/adapters.ts'

const serverTime = '2026-11-05T03:00:02Z'
const startedAt = '2026-11-05T03:00:00Z'
const base = { sessionId: 512, room: { id: 11, name: 'room' }, character: { id: 42, name: 'friend' }, targetMinutes: 3, serverTime }

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
  assert.throws(() => profile({ nickname: 'anonymous', onboardingRequired: false }))
})

test('room details retain the server banner separately from the list thumbnail', () => {
  const result = room({ id: 11, name: '새 룸', characters: [], thumbnailUrl: 'https://assets.example/poster.webp', bannerUrl: 'https://assets.example/banner.webp' })
  assert.equal(result.coverUrl, 'https://assets.example/poster.webp')
  assert.equal(result.bannerUrl, 'https://assets.example/banner.webp')
  assert.equal(room({ id: 11, name: '이전 룸', characters: [] }).bannerUrl, undefined)
})

test('server time corrects a skewed local clock without restoring the retired study goal', () => {
  const localNow = Date.parse('2026-11-05T02:55:02Z')
  const active = session({ ...base, startedAt }, localNow)
  assert.equal(active.serverOffsetMs, 300_000)
  assert.equal(active.elapsedMs, 2000)
  assert.equal(active.startedAt, Date.parse('2026-11-05T02:55:00Z'))
  assert.equal(active.targetSeconds, undefined)
})

test('resume starts at returned study time and never includes server break time', () => {
  const active = session({ ...base, studySeconds: 120, breakSeconds: 600 }, Date.parse(serverTime))
  assert.equal(active.studySeconds, 120)
  assert.equal(active.elapsedMs, 120_000)
  assert.throws(() => session({ ...base }))
})

test('undated goals stay undated and all-day times are not invented', () => {
  assert.deepEqual(memory({ memoryId: 32, type: 'GOAL', title: '기말 준비' }), { id: '32', kind: '목표', title: '기말 준비', date: '', time: '' })
  assert.throws(() => memory({ memoryId: 33, type: 'EXAM', title: '영어 시험' }))
})

test('report values and closing line come from the server without a fabricated target', () => {
  const result = report({ sessionId: 512, character: base.character, startedAt, endedAt: serverTime, studySeconds: 2, presentSeconds: 1, awaySeconds: 1, returnCount: 0, closingLine: '서버 완료 대사' }, '11')
  assert.equal(result.focusSeconds, 1)
  assert.equal(result.targetSeconds, undefined)
  assert.equal(result.serverReport?.closingLine, '서버 완료 대사')
})

test('temporary display names leave source room, model identity and report data untouched', () => {
  const character = { id: 42, name: '말포이 TS', profileImageUrl: '/original.webp' }
  const sourceRoom = { id: 11, name: '기존 룸', characters: [character] }
  const adaptedRoom = room(sourceRoom)
  assert.equal(adaptedRoom.characters[0]?.id, '42')
  assert.equal(adaptedRoom.characters[0]?.name, '채린')
  assert.equal(adaptedRoom.characters[0]?.artworkId, 'chaerin')
  assert.equal(sourceRoom.characters[0]?.name, '말포이 TS')
  const sourceReport = { sessionId: 512, character, startedAt, endedAt: serverTime, studySeconds: 2, presentSeconds: 1, awaySeconds: 1, returnCount: 0 }
  const adaptedReport = report(sourceReport, '11')
  assert.equal(adaptedReport.characterName, '채린')
  assert.deepEqual(adaptedReport.characterIds, ['42'])
  assert.equal(adaptedReport.serverReport, sourceReport)
  assert.equal(adaptedReport.serverReport?.character?.name, '말포이 TS')
})
