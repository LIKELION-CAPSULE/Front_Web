import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEmailAuth } from '../src/features/auth/email-validation.ts'

const valid = { email: 'study@example.com', password: 'test-password', confirmPassword: 'test-password', agreeTerms: true, agreePrivacy: true }
test('signup reports each missing field and agreement without accepting the form', () => {
  assert.deepEqual(Object.keys(validateEmailAuth({ email: '', password: '', confirmPassword: '', agreeTerms: false, agreePrivacy: false }, true, false)), ['email', 'password', 'confirmPassword', 'agreeTerms', 'agreePrivacy'])
})
test('signup rejects a short password and a different confirmation', () => {
  const errors = validateEmailAuth({ ...valid, password: 'short' }, true, true)
  assert.ok(errors.password)
  assert.ok(errors.confirmPassword)
  assert.equal(validateEmailAuth(valid, true, true).confirmPassword, undefined)
})
test('email validity comes from the native input, and whitespace alone is empty', () => {
  assert.ok(validateEmailAuth(valid, true, false).email)
  assert.ok(validateEmailAuth({ ...valid, email: '  ' }, true, true).email)
  assert.deepEqual(validateEmailAuth(valid, true, true), {})
})
test('login requires credentials without enforcing signup-only rules', () => {
  assert.deepEqual(validateEmailAuth({ ...valid, password: 'old', confirmPassword: '', agreeTerms: false, agreePrivacy: false }, false, true), {})
  assert.ok(validateEmailAuth({ ...valid, password: '' }, false, true).password)
})
