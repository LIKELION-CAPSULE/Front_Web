// Runtime rules checked against Backend_lab de5aa98 (2026-11-22).
// OpenAPI does not describe all service-level validation; see docs/API_AUDIT_2026-11-22.md.
export const LEGACY_SESSION_TARGET_MINUTES = 50
export const EMAIL_VERIFICATION_RESEND_MS = 60_000
export const EMAIL_VERIFICATION_VALIDITY_MS = 300_000
export const NICKNAME_MAX_CODE_POINTS = 20
// HTML maxlength counts UTF-16 units; a server-accepted code point can occupy two.
export const NICKNAME_MAX_INPUT_UNITS = NICKNAME_MAX_CODE_POINTS * 2

export function isSessionTargetMinutes(value: number) {
  return Number.isInteger(value) && (value === 3 || value >= 5 && value <= 180 && value % 5 === 0)
}
