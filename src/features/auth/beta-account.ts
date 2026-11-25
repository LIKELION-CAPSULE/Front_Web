import type { LoginResponse, MeResponse } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'
import { birthDateError } from './birth-date.ts'
import type { ReferralValidationResult } from './referral-code.ts'

/** UI-facing account operations. These are not a proposed server wire schema or endpoint. */
/**
 * The profile tab edits the nickname and 「나에 대해」. The server's `honorific` (호칭) is no longer shown or sent (user
 * decision 2026-11-26): a value already saved stays on the server untouched.
 */
export type BetaAccountDetails = {
  birthDate?: string
  aboutMe: string
  referralRegistered?: boolean
}
export type BetaSignupInput = {
  verificationToken: string
  password: string
  nickname: string
  birthDate: string
  agreedTermVersionIds: number[]
  referralCode?: string
}
export type BetaOnboardingInput = {
  nickname: string
  avatarId?: number
  birthDate?: string
  referralCode?: string
}
export type BetaProfileInput = { nickname: string; avatarId?: number; aboutMe: string }
export type BetaAccountResult = { me: MeResponse; details: BetaAccountDetails }

export function checkedAccountDetails(value: BetaAccountDetails): BetaAccountDetails {
  if (!value || typeof value.aboutMe !== 'string' ||
    (value.birthDate !== undefined && (typeof value.birthDate !== 'string' || birthDateError(value.birthDate))) ||
    (value.referralRegistered !== undefined && typeof value.referralRegistered !== 'boolean')) {
    throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
  }
  return {
    ...(value.birthDate === undefined ? {} : { birthDate: value.birthDate }),
    aboutMe: value.aboutMe,
    ...(value.referralRegistered === undefined ? {} : { referralRegistered: value.referralRegistered }),
  }
}

/** Account operations; `server-ports.ts` implements them on the 11-25 API (4 · 8 · 10 · 35 · 36 · 39). */
export type BetaAccountPort = {
  /** `me`: the `/me` response just read, when the caller has it. */
  read: (userId: number, me?: MeResponse) => Promise<BetaAccountDetails>
  signup: (input: BetaSignupInput) => Promise<LoginResponse>
  completeOnboarding: (userId: number, input: BetaOnboardingInput) => Promise<BetaAccountResult>
  saveProfile: (userId: number, input: BetaProfileInput) => Promise<BetaAccountResult>
  validateReferralCode?: (code: string) => Promise<ReferralValidationResult>
  /** API 36 after signup (the signup request has no referral field). */
  enterReferral?: (code: string) => Promise<void>
}
