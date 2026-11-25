import { KAKAO_SIGNUP_CONSENT_SCREEN } from './kakao-signup-contract'
import { devKakaoConsentScreen } from './dev-kakao-consent'

/**
 * Whether the welcome screen relies on the Kakao consent screen (no notice under the button) — the
 * `KAKAO_SIGNUP_CONSENT_SCREEN` flag. On the local dev server only, the local mock and the UI review show the consent
 * path (their mock answers KAKAO_SIGNUP_REQUIRED); `import.meta.env.DEV` is `false` in production builds, so that branch
 * and its module (with its QA key) are removed there.
 */
export function kakaoConsentScreen(): boolean {
  if (import.meta.env.DEV) return devKakaoConsentScreen() ?? KAKAO_SIGNUP_CONSENT_SCREEN
  return KAKAO_SIGNUP_CONSENT_SCREEN
}
