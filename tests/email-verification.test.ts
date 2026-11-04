import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVerificationCode } from '../src/shared/lib/verification-code.ts'
import { createEmailVerificationPreview, emailVerificationPreviewError, PREVIEW_EMAIL_CODE } from '../src/features/auth/email-verification-preview.ts'

test('verification input normalizes full-width digits, pasted spaces and separators', () => {
  assert.equal(normalizeVerificationCode('１２３-４５６'), '123456')
  assert.equal(normalizeVerificationCode('code: 12 34 56\n'), '123456')
  assert.equal(normalizeVerificationCode('123456789'), '123456')
  assert.equal(normalizeVerificationCode('abc---'), '')
  assert.equal(normalizeVerificationCode('12-34-56', 4), '1234')
})

test('preview verification rejects partial, incorrect and expired codes', () => {
  const challenge = createEmailVerificationPreview('study@example.com', 1000)
  assert.ok(emailVerificationPreviewError('123', challenge.expiresAt, 1001))
  assert.ok(emailVerificationPreviewError('654321', challenge.expiresAt, 1001))
  assert.equal(emailVerificationPreviewError(PREVIEW_EMAIL_CODE, challenge.expiresAt, challenge.expiresAt - 1), null)
  assert.ok(emailVerificationPreviewError(PREVIEW_EMAIL_CODE, challenge.expiresAt, challenge.expiresAt))
})

test('renewing a preview challenge renews both expiry and cooldown without storing credentials', () => {
  const first = createEmailVerificationPreview('study@example.com', 1000)
  const renewed = createEmailVerificationPreview(first.email, first.resendAt)
  assert.equal(first.resendAt, 31000)
  assert.equal(first.expiresAt, 601000)
  assert.equal(renewed.resendAt - first.resendAt, 30000)
  assert.equal(renewed.expiresAt - first.expiresAt, 30000)
  assert.deepEqual(Object.keys(renewed).sort(), ['email', 'expiresAt', 'resendAt'])
})
