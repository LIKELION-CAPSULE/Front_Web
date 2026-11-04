/** Accept full-width digits, pasted spaces and separators while keeping a numeric code. */
export function normalizeVerificationCode(value: string, length = 6) {
  return value.normalize('NFKC').replace(/\D/g, '').slice(0, length)
}
