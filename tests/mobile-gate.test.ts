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
