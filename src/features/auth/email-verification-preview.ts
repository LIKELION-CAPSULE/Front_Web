import { normalizeVerificationCode } from '../../shared/lib/verification-code.ts'
import { EMAIL_VERIFICATION_RESEND_MS, EMAIL_VERIFICATION_VALIDITY_MS } from '../../shared/api/constraints.ts'

// UI preview only. These values are not an authentication mechanism or a server policy.
export const PREVIEW_EMAIL_CODE = '123456'

export function createEmailVerificationPreview(email: string, now: number) {
  return { email, expiresAt: now + EMAIL_VERIFICATION_VALIDITY_MS, resendAt: now + EMAIL_VERIFICATION_RESEND_MS }
}

export function emailVerificationPreviewError(code: string, expiresAt: number, now: number) {
  if (now >= expiresAt) return '인증번호의 유효 시간이 지났어요. 새 번호를 받아 주세요.'
  const digits = normalizeVerificationCode(code)
  if (digits.length !== 6) return '인증번호 6자리를 모두 입력해 주세요.'
  if (digits !== PREVIEW_EMAIL_CODE) return '인증번호가 맞지 않아요. 다시 확인해 주세요.'
  return null
}
