/**
 * Kakao first sign-up, proposed contract a′ (2026-11-26, asked of the backend — not final yet).
 *
 * This file is the ONE place that knows the shape of the two calls. If the backend settles on other paths, codes or
 * field names, change them here only; the callback page and the consent screen use what these functions return.
 *
 * 1. `POST /auth/social/KAKAO { code, redirectUri, deviceHash }`
 *    - an existing user: 200 login response (as before)
 *    - a new user: no account is made; 403 `{ code: 'KAKAO_SIGNUP_REQUIRED', detail: { signupToken, expiresInSeconds } }`
 *      (short-lived, single use). A full beta can answer 403 `BETA_FULL` here too.
 * 2. `POST /auth/social/KAKAO/signup { signupToken, agreedTermVersionIds, deviceHash }`
 *    - 200 login response (`isNewUser: true`); onboarding follows as before
 *    - 401 `SIGNUP_TOKEN_EXPIRED` / `SIGNUP_TOKEN_INVALID` → start over with Kakao
 *    - 400 `TERMS_NOT_AGREED` → a required term is missing or not the latest version: read and agree again
 *    - 403 `BETA_FULL` → the launch notice sign-up
 */

/**
 * Whether the backend runs contract a′ yet (switch to `true` when it ships).
 * - `false` (now): the server still makes a new Kakao account on step 1 (200, `isNewUser`), so the welcome screen keeps the
 *   notice under the Kakao button (「시작하면 [이용약관]과 [개인정보 처리방침]에 동의해요.」) and Kakao start still needs
 *   readable terms, as before.
 * - `true`: no notice; a new user reads and agrees on the consent screen (/login/kakao-terms).
 * Either way the callback always handles 403 `KAKAO_SIGNUP_REQUIRED`, so the backend may ship first.
 * Local mock and UI review show the `true` path (kakao-consent-mode.ts).
 */
export const KAKAO_SIGNUP_CONSENT_SCREEN = false

export const KAKAO_LOGIN_PATH = '/auth/social/KAKAO'
export const KAKAO_SIGNUP_PATH = '/auth/social/KAKAO/signup'

/** Used when the server leaves out (or garbles) `expiresInSeconds`: the proposal's 10 minutes. The server still decides. */
const FALLBACK_SIGNUP_SECONDS = 600

export type KakaoSignupRequest = {
  signupToken: string
  agreedTermVersionIds: number[]
  deviceHash: string
}

/** What the consent screen needs from step 1's "new user" answer. `expiresAt` is a local epoch time in ms. */
export type KakaoSignupTicket = { signupToken: string; expiresAt: number }

/** How a failed step 2 is handled on the consent screen. */
export type KakaoSignupFailure = 'expired' | 'invalid' | 'terms' | 'beta-full' | 'failed'

type ErrorLike = { status?: unknown; code?: unknown; detail?: unknown }

function errorParts(error: unknown): ErrorLike | null {
  return error && typeof error === 'object' ? (error as ErrorLike) : null
}

/**
 * Step 1: the sign-up ticket when the error says "a new Kakao user, agree to the terms first"; `null` for anything else
 * (the caller keeps its existing error handling). A missing or empty token is not a ticket.
 */
export function readKakaoSignupRequired(error: unknown, now: number): KakaoSignupTicket | null {
  const parts = errorParts(error)
  if (!parts || parts.code !== 'KAKAO_SIGNUP_REQUIRED') return null
  const detail = parts.detail && typeof parts.detail === 'object' ? (parts.detail as Record<string, unknown>) : {}
  const signupToken = detail.signupToken
  if (typeof signupToken !== 'string' || !signupToken.trim()) return null
  const seconds = detail.expiresInSeconds
  const valid = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
  return { signupToken, expiresAt: now + (valid ? seconds : FALLBACK_SIGNUP_SECONDS) * 1000 }
}

/** Step 2's request body. */
export function kakaoSignupRequest(input: KakaoSignupRequest): KakaoSignupRequest {
  return { signupToken: input.signupToken, agreedTermVersionIds: [...input.agreedTermVersionIds], deviceHash: input.deviceHash }
}

/** Step 2's failures, by code. Anything unknown (network, 5xx) is `failed`: the token is kept and the user may retry. */
export function kakaoSignupFailure(error: unknown): KakaoSignupFailure {
  const code = errorParts(error)?.code
  if (code === 'SIGNUP_TOKEN_EXPIRED') return 'expired'
  if (code === 'SIGNUP_TOKEN_INVALID') return 'invalid'
  if (code === 'TERMS_NOT_AGREED') return 'terms'
  if (code === 'BETA_FULL') return 'beta-full'
  return 'failed'
}
