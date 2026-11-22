const koreanDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** A calendar date, independent of the device's timezone or daylight saving time. */
export function koreaDay(now = Date.now()) {
  const parts = koreanDate.formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
}

export function ageOn(birthDate: string, today = koreaDay()): number | null {
  if (!validCalendarDate(birthDate) || !validCalendarDate(today) || birthDate > today) return null
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0)
}

export type BirthDateFocusField = 'birthYear' | 'birthMonth' | 'birthDay'

export function birthDateError(value: string, today = koreaDay()): string | undefined {
  if (!value) return '생년월일을 입력해 주세요.'
  const segments = value.split('-')
  if (segments.length !== 3) return '생년월일을 확인해 주세요.'
  const [rawYear = '', rawMonth = '', rawDay = ''] = segments
  if (!rawYear && !rawMonth && !rawDay) return '생년월일을 입력해 주세요.'
  if (!rawYear) return '연도를 입력해 주세요'
  if (!/^\d{4}$/.test(rawYear)) return '연도는 4자리로 입력해 주세요 (예: 2002)'
  const year = Number(rawYear)
  if (year < 1900) return '생년월일을 확인해 주세요.'
  if (!rawMonth) return '월을 입력해 주세요'
  if (!rawDay) return '일을 입력해 주세요'
  if (!/^\d{1,2}$/.test(rawMonth) || !/^\d{1,2}$/.test(rawDay)) {
    return '존재하지 않는 날짜예요. 다시 확인해 주세요'
  }
  const month = Number(rawMonth)
  const day = Number(rawDay)
  if (month < 1 || month > 12 || day < 1) {
    return '존재하지 않는 날짜예요. 다시 확인해 주세요'
  }
  const normalized = `${rawYear}-${rawMonth.padStart(2, '0')}-${rawDay.padStart(2, '0')}`
  if (!validCalendarDate(normalized)) {
    return '존재하지 않는 날짜예요. 다시 확인해 주세요'
  }
  const age = ageOn(normalized, today)
  if (age === null) return '생년월일을 확인해 주세요.'
  if (age < 14) return '만 14세 이상부터 가입할 수 있어요'
}

/** Return the specific input name (birthYear | birthMonth | birthDay) to focus for a birthDate error. */
export function birthDateErrorField(value: string): BirthDateFocusField {
  if (!value) return 'birthYear'
  const segments = value.split('-')
  if (segments.length !== 3) return 'birthYear'
  const [rawYear = '', rawMonth = '', rawDay = ''] = segments
  if (!/^\d{4}$/.test(rawYear) || Number(rawYear) < 1900) return 'birthYear'
  const month = /^\d{1,2}$/.test(rawMonth) ? Number(rawMonth) : 0
  if (month < 1 || month > 12) return 'birthMonth'
  const day = /^\d{1,2}$/.test(rawDay) ? Number(rawDay) : 0
  const normalized = `${rawYear}-${rawMonth.padStart(2, '0')}-${rawDay.padStart(2, '0')}`
  if (day < 1 || !validCalendarDate(normalized)) return 'birthDay'
  return 'birthYear'
}

export interface BirthDateParts {
  year: string
  month: string
  day: string
}

/**
 * Parse pasted or serialized birth dates into year/month/day digit parts.
 * Supports YYYY-MM-DD, YYYYMMDD, YYYY.MM.DD, YYYY/MM/DD (with optional spaces).
 */
export function parseBirthDateParts(raw: string): BirthDateParts | null {
  const trimmed = raw.trim()
  if (!trimmed) return { year: '', month: '', day: '' }
  const sepMatch = trimmed.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/)
  if (sepMatch) {
    return {
      year: sepMatch[1]!,
      month: sepMatch[2]!.padStart(2, '0'),
      day: sepMatch[3]!.padStart(2, '0'),
    }
  }
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactMatch) {
    return {
      year: compactMatch[1]!,
      month: compactMatch[2]!,
      day: compactMatch[3]!,
    }
  }
  return null
}

/**
 * Combine 3 text parts into YYYY-MM-DD (or '' if all empty, or a non-empty incomplete token if partially filled).
 */
export function formatBirthDateValue(year: string, month: string, day: string): string {
  const y = year.replace(/\D/g, '').slice(0, 4)
  const m = month.replace(/\D/g, '').slice(0, 2)
  const d = day.replace(/\D/g, '').slice(0, 2)
  if (!y && !m && !d) return ''
  if (y.length === 4 && m.length >= 1 && d.length >= 1) {
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return `${y}-${m}-${d}`
}

/**
 * Month input auto-padding & auto-advance:
 * - First digit 2..9 immediately pads to 02..09 and advances to day.
 * - 0 or 1 waits for the second digit.
 * - Any 2 digits advances to day.
 */
export function normalizeMonthInput(raw: string, prev = ''): { value: string; advance: boolean } {
  const digits = raw.replace(/\D/g, '').slice(0, 2)
  if (digits.length < prev.length) {
    return { value: digits, advance: false }
  }
  if (digits.length === 1 && digits >= '2' && digits <= '9') {
    return { value: `0${digits}`, advance: true }
  }
  if (digits.length === 2) {
    return { value: digits, advance: true }
  }
  return { value: digits, advance: false }
}

/**
 * Day input auto-padding:
 * - First digit 4..9 immediately pads to 04..09 (last field, stays focused).
 * - 0..3 waits for the second digit.
 */
export function normalizeDayInput(raw: string, prev = ''): { value: string } {
  const digits = raw.replace(/\D/g, '').slice(0, 2)
  if (digits.length < prev.length) {
    return { value: digits }
  }
  if (digits.length === 1 && digits >= '4' && digits <= '9') {
    return { value: `0${digits}` }
  }
  return { value: digits }
}
