import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../src/shared/api/client.ts'
import {
  appendCreditPage, creditEntry, creditPage, creditSummary, CreditDataError, displayTitle, referralOwner, referralRefusal, referralView,
} from '../src/features/credits/credits-data.ts'

test('33: the summary card from the server sample; a balance is required, the rest defaults', () => {
  const summary = creditSummary({ todayRemaining: 3500, attendanceRemaining: 1500, attendanceExpiresAt: '2026-11-28T05:00:00+09:00', inviteBalance: 2000,
    low: false, exhausted: false, attendanceGrantedNow: true, todayUsed: 320, invitedFriends: 2 })
  assert.deepEqual(summary, { remaining: 3500, attendance: 1500, invite: 2000, attendanceExpiresAt: Date.parse('2026-11-28T05:00:00+09:00'), todayUsed: 320, invitedFriends: 2 })
  // Only the balance: the invitation part is what the attendance part does not explain; counts are 0; no expiry.
  assert.deepEqual(creditSummary({ todayRemaining: 700 }), { remaining: 700, attendance: 0, invite: 700, attendanceExpiresAt: null, todayUsed: 0, invitedFriends: 0 })
  assert.equal(creditSummary({ todayRemaining: 10, attendanceExpiresAt: 'not a date' }).attendanceExpiresAt, null)
  for (const broken of [null, undefined, {}, { todayRemaining: Number.NaN }, { todayRemaining: '3500' }]) {
    assert.throws(() => creditSummary(broken as never), CreditDataError)
  }
})

test('34: items as the activity list, the screen names 「보이스 대화」 「메이트 음성」, unusable items are left out', () => {
  const page = creditPage({
    items: [
      { id: 12, type: 'USE', title: '고급 모드 · 보이스 대화 · 채린', change: -50, balanceAfter: 3450, createdAt: '2026-11-27T10:00:00+09:00' },
      { id: 11, type: 'ATTENDANCE', title: '출석', change: 1500, balanceAfter: 3500, createdAt: '2026-11-27T05:10:00+09:00' },
      { id: 10, type: 'EXPIRE', title: '출석분 소멸', change: -320, balanceAfter: 2000, createdAt: '2026-11-27T05:00:00+09:00' },
      { id: 9, type: 'INVITE', title: '친구 초대 · 민지님 첫 연결', change: 1000, createdAt: '2026-11-26T21:00:00+09:00' },
      { id: 8, type: 'GIFT', change: 5, createdAt: '2026-11-26T20:00:00+09:00' },
      { id: 7, type: 'USE', title: '빠진 변동', createdAt: '2026-11-26T19:00:00+09:00' },
      { id: 6, type: 'USE', title: '빠진 시각', change: -30 },
      null,
    ] as never,
    nextCursor: '9',
  })
  assert.deepEqual(page.entries.map(entry => [entry.id, entry.kind, entry.title, entry.change, entry.balance]), [
    ['12', 'use', '고급 모드 · 메이트 음성 · 채린', -50, 3450],
    ['11', 'attendance', '출석', 1500, 3500],
    ['10', 'expiration', '출석분 소멸', -320, 2000],
    ['9', 'invite', '친구 초대 · 민지님 첫 연결', 1000, null],
    ['8', 'other', '크레딧 변동', 5, null],
  ])
  assert.equal(page.nextCursor, '9')
  assert.equal(creditPage({ items: [], nextCursor: '' }).nextCursor, null)
  assert.throws(() => creditPage({ nextCursor: null }), CreditDataError)
  assert.throws(() => creditPage(null), CreditDataError)
  // Without an id the item still shows, with a stable key.
  assert.equal(creditEntry({ type: 'USE', title: '고급 모드 · 채린', change: -30, createdAt: '2026-11-27T10:00:00Z' }, 3)?.id, `${Date.parse('2026-11-27T10:00:00Z')}-3`)
  assert.equal(displayTitle('  ', 'attendance'), '출석')
  assert.equal(displayTitle('보이스 대화 · 서진', 'use'), '메이트 음성 · 서진')
})

test('34: a further page is appended without repeating what is shown', () => {
  const first = creditPage({ items: [{ id: 3, type: 'USE', change: -20, createdAt: '2026-11-27T10:00:00Z' }, { id: 2, type: 'USE', change: -20, createdAt: '2026-11-27T09:00:00Z' }], nextCursor: '2' })
  const next = creditPage({ items: [{ id: 2, type: 'USE', change: -20, createdAt: '2026-11-27T09:00:00Z' }, { id: 1, type: 'ATTENDANCE', change: 1500, createdAt: '2026-11-27T05:00:00Z' }], nextCursor: null })
  assert.deepEqual(appendCreditPage(first.entries, next).map(entry => entry.id), ['3', '2', '1'])
})

test('35: the invitation from the server sample; defaults when fields are missing', () => {
  const view = referralView({
    code: 'CAP7K2Q', link: 'https://capsule.ai.kr/i/CAP7K2Q', rewardedCount: 3, maxRewards: 10, rewardedCredits: 3000,
    friends: [
      { nickname: '하준', status: 'JOINED', rewarded: false, joinedAt: '2026-11-27T09:00:00+09:00' },
      { nickname: null, status: 'QUALIFIED', rewarded: true, joinedAt: '2026-11-25T09:00:00+09:00' },
      'broken' as never,
    ],
    canEnterCode: true, codeInputDeadline: '2026-12-01T12:00:00+09:00',
  })
  assert.equal(view.code, 'CAP7K2Q')
  assert.equal(view.link, 'https://capsule.ai.kr/i/CAP7K2Q')
  assert.deepEqual([view.rewardedCount, view.maxRewards, view.rewardedCredits, view.canEnterCode], [3, 10, 3000, true])
  assert.deepEqual(view.friends.map(friend => [friend.nickname, friend.status, friend.rewarded]), [['하준', 'joined', false], [null, 'qualified', true]])
  assert.equal(view.codeInputDeadline, Date.parse('2026-12-01T12:00:00+09:00'))
  assert.deepEqual(referralView({}), { code: '', link: '', rewardedCount: 0, maxRewards: 10, rewardedCredits: 0, friends: [], canEnterCode: false, codeInputDeadline: null })
  assert.equal(referralView({ maxRewards: 0 }).maxRewards, 10)
  assert.throws(() => referralView(null), CreditDataError)
})

test('36 · 39: whose code it is; refusals by code, the ones that close the form', () => {
  assert.deepEqual(referralOwner({ inviterNickname: '민수', rewardOnFirstConnection: 1000 }), { inviterNickname: '민수', reward: 1000 })
  assert.deepEqual(referralOwner(null), { reward: 1000 })
  assert.deepEqual(referralOwner({ inviterNickname: ' ' }), { reward: 1000 })
  const refusal = (code: string, status = 400) => referralRefusal(new ApiError('x', status, code))
  assert.deepEqual(refusal('REFERRAL_SELF'), { code: 'REFERRAL_SELF', message: '내 초대 코드는 입력할 수 없어요.', closesForm: false })
  assert.equal(refusal('REFERRAL_SAME_DEVICE')?.message, '같은 기기에서 가입한 계정의 코드는 입력할 수 없어요.')
  assert.equal(refusal('REFERRAL_CODE_NOT_FOUND', 404)?.closesForm, false)
  assert.equal(refusal('REFERRAL_EXPIRED')?.closesForm, true)
  assert.equal(refusal('REFERRAL_ALREADY_ENTERED', 409)?.closesForm, true)
  // Anything else (network, server, another code) is not a refusal of the code.
  assert.equal(refusal('INTERNAL_ERROR', 500), null)
  assert.equal(referralRefusal(new ApiError('offline', 0)), null)
  assert.equal(referralRefusal(new Error('x')), null)
})
