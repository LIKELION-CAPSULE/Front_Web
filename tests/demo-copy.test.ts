import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { migrateDemoCopy } from '../src/features/demo/copy.ts'
import { withParticle } from '../src/shared/lib/korean.ts'

test('saved system names change without altering payments, progress or user-written text', () => {
  const state = createDemoState()
  state.pass = { name: '캐릭터 패스', expiresAt: 1793458800000, premiumDay: '2026-10-28' }
  state.ledger[0] = { ...state.ledger[0]!, description: '캐릭터 패스 · 카드' }
  state.ledger[1] = { ...state.ledger[1]!, description: '공부 옵션 · 스탠다드' }
  state.ledger[2] = { ...state.ledger[2]!, description: '등급 올리기 · 스탠다드 → 프리미엄 (차액)' }
  state.profile.name = '캐릭터 작가'
  state.memories[0] = { ...state.memories[0]!, title: '캐릭터 디자인 수업' }
  state.messages = [{ id: 'user-copy', sessionId: 'copy', characterId: 'chaerin', sender: 'user', text: '캐릭터 패스가 궁금해', voice: false }]
  const next = migrateDemoCopy(state)
  assert.deepEqual(next.pass, { ...state.pass, name: '친구 패스' })
  assert.deepEqual(next.ledger[0], { ...state.ledger[0], description: '친구 패스 · 카드' })
  assert.equal(next.ledger[1]?.description, '대화 옵션 · 스탠다드')
  assert.equal(next.ledger[2]?.description, '대화 옵션 변경 · 스탠다드 → 프리미엄 (차액)')
  assert.equal(next.credits, state.credits)
  assert.equal(next.records, state.records)
  assert.equal(next.profile, state.profile)
  assert.equal(next.memories, state.memories)
  assert.equal(next.messages, state.messages)
  assert.equal(next.gifts, state.gifts)
  assert.equal(state.pass.name, '캐릭터 패스')
  assert.equal(migrateDemoCopy(next), next)
})

test('current names remain stable and the old exam pass keeps its benefits', () => {
  const current = createDemoState()
  assert.equal(migrateDemoCopy(current), current)
  current.pass = { name: '시험기간 응원 패스', expiresAt: 1793458800000, premiumDay: null }
  assert.deepEqual(migrateDemoCopy(current).pass, { ...current.pass, name: '시험 기간 응원 패스' })
})

test('names use the right particles for studying together and calling a friend', () => {
  assert.equal(withParticle('채린', '과', '와'), '채린과')
  assert.equal(withParticle('수아', '과', '와'), '수아와')
  assert.equal(withParticle('민하준', '이랑', '랑'), '민하준이랑')
  assert.equal(withParticle('유리', '이랑', '랑'), '유리랑')
  assert.equal(withParticle('꾸윙젠렝', '아', '야'), '꾸윙젠렝아')
  assert.equal(withParticle('수아', '아', '야'), '수아야')
  assert.equal(withParticle('채린 · 수아 · 다희', '과', '와'), '채린 · 수아 · 다희와')
  assert.equal(withParticle('Alex', '과', '와'), 'Alex와')
  assert.equal(withParticle('', '과', '와'), '')
})
