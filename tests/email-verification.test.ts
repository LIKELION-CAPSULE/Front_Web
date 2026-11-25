import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVerificationCode } from '../src/shared/lib/verification-code.ts'

test('verification input normalizes full-width digits, pasted spaces and separators', () => {
  assert.equal(normalizeVerificationCode('１２３-４５６'), '123456')
  assert.equal(normalizeVerificationCode('code: 12 34 56\n'), '123456')
  assert.equal(normalizeVerificationCode('123456789'), '123456')
  assert.equal(normalizeVerificationCode('abc---'), '')
  assert.equal(normalizeVerificationCode('12-34-56', 4), '1234')
})
