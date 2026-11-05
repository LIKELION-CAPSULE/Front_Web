import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordResetLocation } from '../src/features/auth/password-reset-location.ts'
import { authNotice, kakaoErrorNotice } from '../src/features/auth/auth-notices.ts'
import { ApiError } from '../src/shared/api/client.ts'

test('reset token is captured in memory and removed without losing unrelated query or fragment', () => {
  const result = passwordResetLocation('https://front.example/password/reset?token=pr_secret&next=%2F&source=mail#form')
  assert.equal(result.token, 'pr_secret')
  assert.equal(result.cleanPath, '/password/reset?next=%2F&source=mail#form')
  assert.doesNotMatch(result.cleanPath, /pr_secret|token=/)
})

test('every duplicate token is removed while the original credential remains intact', () => {
  const result = passwordResetLocation('http://localhost:3000/password/reset?token=pr_%2B%2F%3D&token=other')
  assert.equal(result.token, 'pr_+/=')
  assert.equal(result.cleanPath, '/password/reset')
})

test('missing and empty reset credentials cannot create an active reset form', () => {
  assert.equal(passwordResetLocation('https://front.example/password/reset').token, null)
  assert.deepEqual(passwordResetLocation('https://front.example/password/reset?token='), { token: null, cleanPath: '/password/reset' })
})

test('reset capture is pure across StrictMode initializer replay', () => {
  const href = 'https://front.example/password/reset?token=pr_once'
  assert.deepEqual(passwordResetLocation(href), passwordResetLocation(href))
})

test('login notices only accept known own keys and never reflect arbitrary query text', () => {
  for (const value of [null, '__proto__', 'constructor', 'toString', '<script>secret</script>']) assert.equal(authNotice(value), null)
  assert.equal(authNotice('password-reset')?.tone, 'success')
})

test('OAuth API failures map to fixed login notices without exposing the original error', () => {
  assert.equal(kakaoErrorNotice(new ApiError('private upstream detail', 400, 'TERMS_REQUIRED')), 'kakao-terms-required')
  assert.equal(kakaoErrorNotice(new ApiError('code already consumed', 401, 'SOCIAL_AUTH_FAILED')), 'kakao-expired')
  assert.equal(kakaoErrorNotice(new Error('private detail')), 'kakao-failed')
})
