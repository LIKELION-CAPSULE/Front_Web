import { api, ApiError } from '@/shared/api/client'
import type { LoginResponse, MeResponse } from '@/shared/api/types'
import type { BetaAccountDetails, BetaAccountPort } from '@/features/auth/beta-account'
import { simulateMockReferralValidation } from '@/features/auth/referral-code'
import type { ReviewScenario } from './catalog'
import { REVIEW_USER_ID } from './fixtures'

/** Explicit in-memory UI simulation, never a backend contract or a production adapter. */
export function createReviewAccountPort(scenario: ReviewScenario): BetaAccountPort {
  const accounts = new Map<number, BetaAccountDetails>()
  if (scenario.id === 'email-onboarding') {
    accounts.set(REVIEW_USER_ID, { birthDate: '2000-01-01', aboutMe: '' })
  }
  const read = (userId: number): BetaAccountDetails => ({ ...(accounts.get(userId) ?? { aboutMe: '' }) })
  function trace(operation: string, input: unknown) {
    window.dispatchEvent(new CustomEvent('capsule-review:account-operation', { detail: { operation, input } }))
  }
  async function update(userId: number, nickname: string, avatarId?: number) {
    const me = await api.request<MeResponse>('/me', {
      method: 'PATCH',
      body: { nickname, ...(avatarId === undefined ? {} : { avatarId }) },
    })
    if (me.userId !== userId) throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
    return me
  }
  return {
    read: async (userId) => read(userId),
    validateReferralCode: async (code) =>
      simulateMockReferralValidation(code, {
        alreadyRegistered: Boolean(read(REVIEW_USER_ID).referralRegistered),
        ownCode: 'SELF',
      }),
    signup: async (input) => {
      trace('signup', input)
      const { birthDate, referralCode, ...legacy } = input
      // Only the published fields go through the legacy fixture. New fields live in this mock port alone.
      const result = await api.request<LoginResponse>('/auth/email/signup', {
        method: 'POST',
        auth: false,
        body: legacy,
      })
      const referralRegistered = Boolean(
        referralCode && simulateMockReferralValidation(referralCode).valid,
      )
      accounts.set(result.userId ?? REVIEW_USER_ID, {
        birthDate,
        aboutMe: '',
        ...(referralRegistered ? { referralRegistered: true } : {}),
      })
      return result
    },
    completeOnboarding: async (userId, input) => {
      trace('completeOnboarding', input)
      const me = await update(userId, input.nickname, input.avatarId)
      const prev = read(userId)
      const referralRegistered =
        prev.referralRegistered ||
        Boolean(input.referralCode && simulateMockReferralValidation(input.referralCode).valid)
      const details: BetaAccountDetails = {
        ...prev,
        birthDate: input.birthDate,
        ...(referralRegistered ? { referralRegistered: true } : {}),
      }
      accounts.set(userId, details)
      return { me, details }
    },
    saveProfile: async (userId, input) => {
      trace('saveProfile', input)
      const me = await update(userId, input.nickname, input.avatarId)
      const details = { ...read(userId), aboutMe: input.aboutMe }
      accounts.set(userId, details)
      return { me, details }
    },
  }
}
