import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEmailAuth } from '../src/features/auth/email-validation.ts'

const valid = { email: 'study@example.com', password: 'test-password', confirmPassword: 'test-password', nickname: '공부친구', agreeTerms: true, agreePrivacy: true }
test('signup reports each missing field and agreement without accepting the form', () => {
  assert.deepEqual(Object.keys(validateEmailAuth({ email: '', password: '', confirmPassword: '', nickname: '', agreeTerms: false, agreePrivacy: false }, true, false)), ['email', 'password', 'confirmPassword', 'nickname', 'agreeTerms', 'agreePrivacy'])
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
  assert.deepEqual(validateEmailAuth({ ...valid, password: 'old', confirmPassword: '', nickname: '', agreeTerms: false, agreePrivacy: false }, false, true), {})
  assert.ok(validateEmailAuth({ ...valid, password: '' }, false, true).password)
})

test('signup requires a non-blank nickname of at most 20 characters', () => {
  for (const nickname of ['', '   ', '\t\n', '가'.repeat(21)]) {
    assert.ok(validateEmailAuth({ ...valid, nickname }, true, true).nickname)
  }
  for (const nickname of ['가', '가'.repeat(20), '  공부친구  ']) {
    assert.deepEqual(validateEmailAuth({ ...valid, nickname }, true, true), {})
  }
})
