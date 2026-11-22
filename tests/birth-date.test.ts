import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ageOn,
  birthDateError,
  birthDateErrorField,
  formatBirthDateValue,
  koreaDay,
  normalizeDayInput,
  normalizeMonthInput,
  parseBirthDateParts,
  validCalendarDate,
} from '../src/features/auth/birth-date.ts'
import { checkedAccountDetails } from '../src/features/auth/beta-account.ts'
import { validateEmailAuth } from '../src/features/auth/email-validation.ts'

test('birth dates require a real Gregorian calendar date without overflow or alternate encodings', () => {
  for (const date of ['0001-01-01', '2000-02-29', '2012-02-29', '2004-12-31']) assert.equal(validCalendarDate(date), true, date)
  for (const date of ['', '0000-01-01', '1900-02-29', '2001-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '2026-1-01', '2026-11-22T00:00:00Z']) assert.equal(validCalendarDate(date), false, date)
})

test('14 and 19 year boundaries use the birthday rather than the birth year', () => {
  assert.equal(ageOn('2012-11-23', '2026-11-22'), 13)
  assert.equal(ageOn('2012-11-22', '2026-11-22'), 14)
  assert.equal(ageOn('2007-11-23', '2026-11-22'), 18)
  assert.equal(ageOn('2007-11-22', '2026-11-22'), 19)
  assert.equal(birthDateError('2012-11-23', '2026-11-22'), '만 14세 이상부터 가입할 수 있어요')
  assert.equal(birthDateError('2012-11-22', '2026-11-22'), undefined)
})

test('the Korean calendar day changes at midnight even when the device timezone differs', () => {
  assert.equal(koreaDay(Date.parse('2026-11-21T14:59:59.999Z')), '2026-11-21')
  assert.equal(koreaDay(Date.parse('2026-11-21T15:00:00.000Z')), '2026-11-22')
  assert.equal(ageOn('2012-11-22', koreaDay(Date.parse('2026-11-21T14:59:59.999Z'))), 13)
  assert.equal(ageOn('2012-11-22', koreaDay(Date.parse('2026-11-21T15:00:00.000Z'))), 14)
})

test('February 29 birthdays wait until March 1 in a non-leap year', () => {
  assert.equal(ageOn('2012-02-29', '2026-02-28'), 13)
  assert.equal(ageOn('2012-02-29', '2026-03-01'), 14)
  assert.equal(ageOn('2008-02-29', '2027-02-28'), 18)
  assert.equal(ageOn('2008-02-29', '2027-03-01'), 19)
  assert.equal(ageOn('2012-02-29', '2028-02-28'), 15)
  assert.equal(ageOn('2012-02-29', '2028-02-29'), 16)
})

test('missing, impossible, pre-1900, and future birth dates return specific messages', () => {
  assert.equal(birthDateError('', '2026-11-22'), '생년월일을 입력해 주세요.')
  for (const date of ['2027-01-01', '9999-12-31', '1899-12-31']) {
    assert.equal(birthDateError(date, '2026-11-22'), '생년월일을 확인해 주세요.')
  }
  assert.equal(ageOn('2012-02-30', '2026-11-22'), null)
  assert.equal(birthDateError('2012-02-30', '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
})

test('4-digit year error, valid 2002/1/3, and invalid calendar date errors & focus targets', () => {
  const twoDigitYear = formatBirthDateValue('02', '1', '3')
  assert.equal(birthDateError(twoDigitYear, '2026-11-22'), '연도는 4자리로 입력해 주세요 (예: 2002)')
  assert.equal(birthDateErrorField(twoDigitYear), 'birthYear')

  const valid = formatBirthDateValue('2002', '1', '3')
  assert.equal(valid, '2002-01-03')
  assert.equal(birthDateError(valid, '2026-11-22'), undefined)

  const feb30 = formatBirthDateValue('2002', '2', '30')
  assert.equal(birthDateError(feb30, '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
  assert.equal(birthDateErrorField(feb30), 'birthDay')

  const month13 = formatBirthDateValue('2002', '13', '1')
  assert.equal(birthDateError(month13, '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
  assert.equal(birthDateErrorField(month13), 'birthMonth')

  const nonLeapFeb29 = formatBirthDateValue('2001', '2', '29')
  assert.equal(birthDateError(nonLeapFeb29, '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
  assert.equal(birthDateErrorField(nonLeapFeb29), 'birthDay')
})

test('month and day smart auto-padding and auto-advance rules', () => {
  assert.deepEqual(normalizeMonthInput('2'), { value: '02', advance: true })
  assert.deepEqual(normalizeMonthInput('9'), { value: '09', advance: true })
  assert.deepEqual(normalizeMonthInput('1'), { value: '1', advance: false })
  assert.deepEqual(normalizeMonthInput('0'), { value: '0', advance: false })
  assert.deepEqual(normalizeMonthInput('12', '1'), { value: '12', advance: true })
  assert.deepEqual(normalizeDayInput('5'), { value: '05' })
  assert.deepEqual(normalizeDayInput('4'), { value: '04' })
  assert.deepEqual(normalizeDayInput('3'), { value: '3' })
  assert.deepEqual(normalizeDayInput('0'), { value: '0' })
  assert.deepEqual(normalizeDayInput('31', '3'), { value: '31' })
})

test('signup checks the required birth date and login keeps accepting existing credentials', () => {
  const values = { email: 'review@example.invalid', password: 'old', confirmPassword: '', nickname: '', birthDate: '', agreeTerms: false, agreePrivacy: false }
  assert.deepEqual(validateEmailAuth(values, false, true, '2026-11-22'), {})
  assert.equal(validateEmailAuth(values, true, true, '2026-11-22').birthDate, '생년월일을 입력해 주세요.')
  assert.equal(validateEmailAuth({ ...values, birthDate: '2020-01-01' }, true, true, '2026-11-22').birthDate, '만 14세 이상부터 가입할 수 있어요')
})

test('account details reject invalid server shapes and expose only the approved UI fields', () => {
  const details = { birthDate: '2000-01-01', callName: '호칭', aboutMe: '소개' }
  assert.deepEqual(checkedAccountDetails({ ...details, token: 'must-not-propagate' } as typeof details), details)
  assert.deepEqual(checkedAccountDetails({ callName: '', aboutMe: '' }), { callName: '', aboutMe: '' })
  for (const value of [null, {}, { ...details, birthDate: '2020-01-01' }, { ...details, birthDate: '2000-02-30' }, { ...details, aboutMe: null }]) {
    assert.throws(() => checkedAccountDetails(value as typeof details), { status: 502 })
  }
})

test('parseBirthDateParts supports hyphen, compact, dot, and slash paste formats', () => {
  assert.deepEqual(parseBirthDateParts('2005-03-14'), { year: '2005', month: '03', day: '14' })
  assert.deepEqual(parseBirthDateParts('20050314'), { year: '2005', month: '03', day: '14' })
  assert.deepEqual(parseBirthDateParts('2005.03.14'), { year: '2005', month: '03', day: '14' })
  assert.deepEqual(parseBirthDateParts('2005. 3. 4.'), { year: '2005', month: '03', day: '04' })
  assert.deepEqual(parseBirthDateParts('2005/3/14'), { year: '2005', month: '03', day: '14' })
  assert.equal(parseBirthDateParts('not-a-date'), null)
})

test('empty individual birth date fields return specific field messages and focus targets', () => {
  assert.equal(birthDateError('2002--', '2026-11-22'), '월을 입력해 주세요')
  assert.equal(birthDateErrorField('2002--'), 'birthMonth')

  assert.equal(birthDateError('2002-1-', '2026-11-22'), '일을 입력해 주세요')
  assert.equal(birthDateErrorField('2002-1-'), 'birthDay')

  assert.equal(birthDateError('-1-3', '2026-11-22'), '연도를 입력해 주세요')
  assert.equal(birthDateErrorField('-1-3'), 'birthYear')

  assert.equal(birthDateError('2002-0-3', '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
  assert.equal(birthDateError('2002-02-30', '2026-11-22'), '존재하지 않는 날짜예요. 다시 확인해 주세요')
})

test('formatBirthDateValue returns empty string when blank, YYYY-MM-DD when complete, and invalid token when partial', () => {
  assert.equal(formatBirthDateValue('', '', ''), '')
  assert.equal(formatBirthDateValue('2005', '3', '4'), '2005-03-04')
  assert.equal(formatBirthDateValue('2005', '03', '14'), '2005-03-14')
  assert.equal(birthDateError(formatBirthDateValue('2005', '', ''), '2026-11-22'), '월을 입력해 주세요')
  assert.equal(birthDateError(formatBirthDateValue('', '', ''), '2026-11-22'), '생년월일을 입력해 주세요.')
})
