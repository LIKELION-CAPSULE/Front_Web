import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isMobileGateAllowedPath,
  isPhoneDevice,
  MOBILE_GATE_ALLOWED_PATHS,
} from '../src/shared/lib/mobile-gate.ts'

test('isPhoneDevice requires coarse/no-hover pointer AND short side under 600px, never desktop 640px windows', () => {
  assert.equal(isPhoneDevice({ coarseNoHover: true, shortSidePx: 390 }), true)
  assert.equal(isPhoneDevice({ coarseNoHover: true, shortSidePx: 599 }), true)
  assert.equal(isPhoneDevice({ coarseNoHover: true, shortSidePx: 600 }), false)
  assert.equal(isPhoneDevice({ coarseNoHover: false, shortSidePx: 390 }), false)
  assert.equal(isPhoneDevice({ coarseNoHover: false, shortSidePx: 640 }), false)
})

test('MOBILE_GATE_ALLOWED_PATHS allows password reset links on mobile phones', () => {
  assert.ok(MOBILE_GATE_ALLOWED_PATHS.includes('/password/reset'))
  assert.equal(isMobileGateAllowedPath('/password/reset'), true)
  assert.equal(isMobileGateAllowedPath('/password/reset/'), true)
  assert.equal(isMobileGateAllowedPath('/reset-password'), true)
  assert.equal(isMobileGateAllowedPath('/'), false)
  assert.equal(isMobileGateAllowedPath('/login'), false)
  assert.equal(isMobileGateAllowedPath('/connect/chaerin'), false)
})

test('resolveMobileInvite: address first (ref / invite / inviter), else the stored code; none without a code', async () => {
  const { resolveMobileInvite } = await import('../src/features/mobile-gate/share-link.ts')
  assert.deepEqual(resolveMobileInvite('?ref= cap-7k2q ', null), { code: 'CAP-7K2Q', inviter: null })
  assert.deepEqual(resolveMobileInvite('?invite=abc&inviter=%20민수%20', null), { code: 'ABC', inviter: '민수' })
  // `/i/<code>` became `/invite` with the code stored (captureReferralFromLocation): the stored code is shown.
  assert.deepEqual(resolveMobileInvite('', { code: 'CAP-7K2Q', inviterNickname: '민수' }), { code: 'CAP-7K2Q', inviter: '민수' })
  assert.deepEqual(resolveMobileInvite('?ref=NEW', { code: 'OLD' }), { code: 'NEW', inviter: null })
  assert.equal(resolveMobileInvite('', null), null)
  assert.equal(resolveMobileInvite('?ref=%20', null), null)
})

test('buildMobileShareUrl keeps the page, drops the review marker and carries the invite code to the PC', async () => {
  const { buildMobileShareUrl } = await import('../src/features/mobile-gate/share-link.ts')
  const origin = 'https://capsule.ai.kr'
  assert.equal(buildMobileShareUrl(origin, '/invite', '', '', 'CAP-7K2Q'), 'https://capsule.ai.kr/invite?ref=CAP-7K2Q')
  assert.equal(buildMobileShareUrl(origin, '/', '?__review=mobile-notice', '', null), 'https://capsule.ai.kr/')
  assert.equal(buildMobileShareUrl(origin, '/credits', '?ref=MINE', '#top', 'OTHER'), 'https://capsule.ai.kr/credits?ref=MINE#top')
  assert.equal(buildMobileShareUrl(origin, '/', '?invite=X', '', 'Y'), 'https://capsule.ai.kr/?invite=X')
})
