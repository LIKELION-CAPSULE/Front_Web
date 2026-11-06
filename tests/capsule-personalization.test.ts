import assert from 'node:assert/strict'
import test from 'node:test'
import { capsuleInscription } from '../src/features/session/prepare-capsule-personalization.ts'

test('engraving uses the start goal and the Seoul calendar date', () => {
  const result = capsuleInscription({ nickname: '  공부하는 나 ', targetMinutes: 3, characterName: '말포이', createdAt: Date.UTC(2026, 10, 6, 15, 1) })
  assert.equal(result.nickname, '공부하는 나')
  assert.equal(result.detail, '3분 · 말포이')
  assert.equal(result.date, '2026.11.07')
})

test('truncation preserves complete emoji and keeps the full names in the accessible summary', () => {
  const nickname = '🧑🏽‍💻'.repeat(11)
  const result = capsuleInscription({ nickname, targetMinutes: 25, characterName: '아주아주이름이긴친구입니다', createdAt: 0 })
  assert.equal(result.nickname, '🧑🏽‍💻'.repeat(9) + '…')
  assert.ok(result.summary.includes(nickname))
  assert.ok(result.summary.includes('아주아주이름이긴친구입니다'))
})

test('blank labels and invalid goals have readable fallbacks', () => {
  const result = capsuleInscription({ nickname: '  ', targetMinutes: NaN, characterName: '', createdAt: 0 })
  assert.equal(result.nickname, '나')
  assert.equal(result.detail, '공부 · 친구')
})
