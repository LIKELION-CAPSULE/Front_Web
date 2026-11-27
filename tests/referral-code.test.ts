import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERRAL_TTL_MS,
  captureReferralFromLocation,
  clearStoredReferralCode,
  formatNicknameGreeting,
  normalizeReferralCode,
  readStoredReferralCode,
  saveStoredReferralCode,
  shouldApplyIncomingReferral,
  simulateMockReferralValidation,
  subscribeStoredReferralCode,
  type StorageLike,
} from '../src/features/auth/referral-code.ts'

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

test('formatNicknameGreeting picks Korean particle by final batchim and falls back cleanly for non-Korean', () => {
  assert.equal(formatNicknameGreeting('민수'), '민수구나, 반가워!')
  assert.equal(formatNicknameGreeting('지민'), '지민이구나, 반가워!')
  assert.equal(formatNicknameGreeting('  하늘  '), '하늘이구나, 반가워!')
  assert.equal(formatNicknameGreeting('Alex'), 'Alex, 반가워!')
  assert.equal(formatNicknameGreeting('user99'), 'user99, 반가워!')
})

test('normalizeReferralCode trims, uppercases, and clamps to 20 chars', () => {
  assert.equal(normalizeReferralCode('  friend1000  '), 'FRIEND1000')
  assert.equal(normalizeReferralCode('abcdefghijklmnopqrstuvwxyz').length, 20)
})

test('captureReferralFromLocation synchronously stores ?ref= before render and cleans URL via replaceState', () => {
  const storage = createMemoryStorage()
  let replacedUrl = ''
  const now = 1_700_000_000_000
  const captured = captureReferralFromLocation(
    { pathname: '/login', search: '?mode=signup&ref=friend1000&next=%2Frecords', hash: '' },
    {
      replaceState: (_state, _unused, url) => {
        replacedUrl = String(url ?? '')
      },
    },
    storage,
    now,
  )
  assert.deepEqual(captured, { code: 'FRIEND1000' })
  assert.equal(replacedUrl, '/login?mode=signup&next=%2Frecords')
  assert.deepEqual(readStoredReferralCode(now + 1000, storage), { code: 'FRIEND1000' })
})

test('captureReferralFromLocation takes the invite link /i/<code> (35 link) and opens the invitation screen', () => {
  const storage = createMemoryStorage()
  let replacedUrl = ''
  const now = 1_700_000_000_000
  const history = { replaceState: (_state: unknown, _unused: string, url?: string | URL | null) => { replacedUrl = String(url ?? '') } }
  assert.deepEqual(captureReferralFromLocation({ pathname: '/i/capsule2026', search: '?utm=kakao', hash: '' }, history, storage, now), { code: 'CAPSULE2026' })
  assert.equal(replacedUrl, '/invite?utm=kakao')
  assert.deepEqual(readStoredReferralCode(now + 1000, storage), { code: 'CAPSULE2026' })
  // Not an invite link: nothing stored, the address kept.
  replacedUrl = ''
  assert.equal(captureReferralFromLocation({ pathname: '/invite', search: '', hash: '' }, history, createMemoryStorage(), now), null)
  assert.equal(replacedUrl, '')
})

test('stored referral code expires cleanly after 7 days', () => {
  const storage = createMemoryStorage()
  const t0 = 1_700_000_000_000
  assert.equal(saveStoredReferralCode('FRIEND1000', '민수', storage, t0), true)
  assert.deepEqual(readStoredReferralCode(t0 + REFERRAL_TTL_MS - 1, storage), {
    code: 'FRIEND1000',
    inviterNickname: '민수',
  })
  assert.equal(readStoredReferralCode(t0 + REFERRAL_TTL_MS, storage), null)
  // Expired entry should have been removed
  assert.equal(readStoredReferralCode(t0, storage), null)
})

test('shouldApplyIncomingReferral preserves user-typed values and never overwrites non-empty input', () => {
  assert.equal(shouldApplyIncomingReferral('', false), true)
  assert.equal(shouldApplyIncomingReferral('   ', false), true)
  assert.equal(shouldApplyIncomingReferral('TYPED123', false), false)
  assert.equal(shouldApplyIncomingReferral('', true), false)
  assert.equal(shouldApplyIncomingReferral('TYPED123', true), false)
})

test('referral storage degrades gracefully when localStorage throws', () => {
  const throwingStorage: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: () => {
      throw new Error('SecurityError')
    },
  }
  const received: string[] = []
  const unsub = subscribeStoredReferralCode((s) => received.push(s.code))
  try {
    assert.equal(saveStoredReferralCode('FRIEND1000', undefined, throwingStorage), false)
    assert.deepEqual(received, ['FRIEND1000'])
    assert.equal(readStoredReferralCode(Date.now(), throwingStorage), null)
    assert.doesNotThrow(() => clearStoredReferralCode(throwingStorage))
  } finally {
    unsub()
  }
})

test('simulateMockReferralValidation reproduces valid, invalid, self, and already_registered cases', () => {
  assert.deepEqual(simulateMockReferralValidation('friend1000'), {
    valid: true,
    inviterNickname: '민수',
  })
  const invalidRes = simulateMockReferralValidation('NOPE123')
  assert.equal(invalidRes.valid, false)
  if (!invalidRes.valid) assert.equal(invalidRes.message, '확인할 수 없는 코드예요. 지우거나 고쳐 주세요')
  const selfRes = simulateMockReferralValidation('LOCALCAPSULE', { ownCode: 'LOCALCAPSULE' })
  assert.equal(selfRes.valid, false)
  if (!selfRes.valid) {
    assert.equal(selfRes.reason, 'self')
    assert.equal(selfRes.message, '내 초대 코드는 입력할 수 없어요.')
  }
  const alreadyRes = simulateMockReferralValidation('FRIEND1000', { alreadyRegistered: true })
  assert.equal(alreadyRes.valid, false)
  if (!alreadyRes.valid) {
    assert.equal(alreadyRes.reason, 'already_registered')
    assert.equal(alreadyRes.message, '이미 초대 코드가 등록된 계정이에요.')
  }
})
