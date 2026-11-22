import type { LoginResponse, MeResponse } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'
import { birthDateError } from './birth-date.ts'
import type { ReferralValidationResult } from './referral-code.ts'

/** UI-facing account operations. These are not a proposed server wire schema or endpoint. */
export type BetaAccountDetails = {
  birthDate?: string
  callName: string
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
export type BetaProfileInput = { nickname: string; avatarId?: number; callName: string; aboutMe: string }
export type BetaAccountResult = { me: MeResponse; details: BetaAccountDetails }

export function checkedAccountDetails(value: BetaAccountDetails): BetaAccountDetails {
  if (!value || typeof value.callName !== 'string' || typeof value.aboutMe !== 'string' ||
    (value.birthDate !== undefined && (typeof value.birthDate !== 'string' || birthDateError(value.birthDate))) ||
    (value.referralRegistered !== undefined && typeof value.referralRegistered !== 'boolean')) {
    throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
  }
  return {
    ...(value.birthDate === undefined ? {} : { birthDate: value.birthDate }),
    callName: value.callName,
    aboutMe: value.aboutMe,
    ...(value.referralRegistered === undefined ? {} : { referralRegistered: value.referralRegistered }),
  }
}

/** Must be implemented against an agreed backend contract before production can save the new fields. */
export type BetaAccountPort = {
  read: (userId: number) => Promise<BetaAccountDetails>
  signup: (input: BetaSignupInput) => Promise<LoginResponse>
  completeOnboarding: (userId: number, input: BetaOnboardingInput) => Promise<BetaAccountResult>
  saveProfile: (userId: number, input: BetaProfileInput) => Promise<BetaAccountResult>
  validateReferralCode?: (code: string) => Promise<ReferralValidationResult>
}
