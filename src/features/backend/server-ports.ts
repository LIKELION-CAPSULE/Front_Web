import { ApiError, type ApiClient } from '../../shared/api/client.ts'
import { deviceHash } from '../../shared/api/device-hash.ts'
import type { LoginResponse, MateDetailResponse, MeResponse, SignupRequest, UpdateMeRequest } from '../../shared/api/types.ts'
import type { BetaAccountDetails, BetaAccountPort } from '../auth/beta-account.ts'
import { normalizeReferralCode, type ReferralValidationResult } from '../auth/referral-code.ts'
import type { MateContentPort, MateDetailContent } from '../mates/mate-contract.ts'
import { serverAgeRating } from '../mates/catalog.ts'
import { checkReferral, enterReferral, getMateDetail, getMe, getMyReferral, updateMe } from './server-api.ts'

type Client = Pick<ApiClient, 'request'>

const text = (value: string | null | undefined) => typeof value === 'string' ? value : undefined

/** `/me` → the profile fields the onboarding and profile screens edit (`honorific` is the front-end `callName`). */
export function accountDetails(me: MeResponse, referralRegistered?: boolean): BetaAccountDetails {
  return {
    ...(me.birthDate ? { birthDate: me.birthDate } : {}),
    callName: me.honorific ?? '',
    aboutMe: me.aboutMe ?? '',
    ...(referralRegistered === undefined ? {} : { referralRegistered }),
  }
}

/**
 * 11-25 account port: signup (4) with `birthDate` · `deviceHash`, onboarding and profile (10), referral check (39) and
 * entry (36). Production and the local mock use this same port; the mock answers the same paths.
 */
export function createServerAccountPort(client: Client, device: () => Promise<string> = () => deviceHash()): BetaAccountPort {
  /** 35 `canEnterCode` false = a code was entered (or the 7 days passed). Only onboarding needs it, so only then. */
  async function referralRegistered(me: MeResponse) {
    if (!me.onboardingRequired) return undefined
    try { return (await getMyReferral(client)).canEnterCode === false } catch { return undefined }
  }
  async function enter(code: string) {
    await enterReferral(client, { code: normalizeReferralCode(code), deviceHash: await device() })
  }
  return {
    read: async (_userId, me) => {
      const value = me ?? await getMe(client)
      return accountDetails(value, await referralRegistered(value))
    },
    signup: async input => {
      const body: SignupRequest = {
        verificationToken: input.verificationToken, password: input.password, nickname: input.nickname,
        agreedTermVersionIds: input.agreedTermVersionIds, birthDate: input.birthDate, deviceHash: await device(),
      }
      // The referral code is entered (36) after sign-in; DemoProvider does it once the token is set.
      return client.request<LoginResponse>('/auth/email/signup', { method: 'POST', auth: false, body })
    },
    completeOnboarding: async (_userId, input) => {
      const body: UpdateMeRequest = {
        nickname: input.nickname,
        ...(input.avatarId === undefined ? {} : { avatarId: input.avatarId }),
        ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      }
      const me = await updateMe(client, body)
      let registered: boolean | undefined
      if (input.referralCode) {
        // A refused code (REFERRAL_*) never fails onboarding; it can be entered later on the invite screen.
        try { await enter(input.referralCode); registered = true } catch { registered = undefined }
      }
      return { me, details: accountDetails(me, registered) }
    },
    saveProfile: async (_userId, input) => {
      const me = await updateMe(client, {
        nickname: input.nickname,
        ...(input.avatarId === undefined ? {} : { avatarId: input.avatarId }),
        honorific: input.callName,
        aboutMe: input.aboutMe,
      })
      return { me, details: accountDetails(me) }
    },
    validateReferralCode: async (raw): Promise<ReferralValidationResult> => {
      const code = normalizeReferralCode(raw)
      if (!code) return { valid: false, reason: 'invalid', message: '초대 코드를 확인해 주세요.' }
      try {
        const result = await checkReferral(client, code)
        return { valid: true, ...(result.inviterNickname ? { inviterNickname: result.inviterNickname } : {}) }
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'REFERRAL_CODE_NOT_FOUND' || error.status === 404)) {
          return { valid: false, reason: 'invalid', message: '확인할 수 없는 코드예요. 지우거나 고쳐 주세요' }
        }
        throw error
      }
    },
    enterReferral: enter,
  }
}

/** 31 → the detail screen's projection. Server copy wins over the front-end catalogue copy where present. */
export function mateDetailContent(dto: MateDetailResponse, characterId: number): MateDetailContent {
  if (dto.id !== characterId) throw new ApiError('메이트 정보를 확인하지 못했어요.', 502)
  const model = dto.model?.modelJsonUrl ? {
    modelJsonUrl: dto.model.modelJsonUrl,
    ...(typeof dto.model.scale === 'number' ? { scale: dto.model.scale } : {}),
    ...(typeof dto.model.offsetX === 'number' ? { offsetX: dto.model.offsetX } : {}),
    ...(typeof dto.model.offsetY === 'number' ? { offsetY: dto.model.offsetY } : {}),
    ...(dto.model.format ? { format: dto.model.format } : {}),
    ...(dto.model.engineUrl ? { engineUrl: dto.model.engineUrl } : {}),
    ...(dto.model.playerUrl ? { playerUrl: dto.model.playerUrl } : {}),
    ...(dto.model.reactionsUrl ? { reactionsUrl: dto.model.reactionsUrl } : {}),
  } : undefined
  const optional = {
    introduction: text(dto.oneLiner), description: text(dto.world), role: text(dto.myRole), intro: text(dto.intro),
    voiceSampleUrl: text(dto.voiceSampleUrl),
  }
  return {
    characterId,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined && value.trim() !== '')),
    ...(Array.isArray(dto.hashtags) ? { tags: dto.hashtags.filter(tag => typeof tag === 'string') } : {}),
    ...(model ? { model } : {}),
    ...(serverAgeRating(dto.ageRating) ? { ageRating: serverAgeRating(dto.ageRating) } : {}),
    ...(typeof dto.comingSoon === 'boolean' ? { comingSoon: dto.comingSoon } : {}),
    ...(typeof dto.hasConversation === 'boolean' ? { hasConversation: dto.hasConversation } : {}),
  }
}

/**
 * 31 mate detail. The conversation reset (47) keeps the old revision contract out: the server has no revision and a
 * different reset scope (docs/API_FRONT_GAP_2026-11-25.md §13), so `resetConversation` stays unset here.
 */
export function createServerMatePort(client: Client): MateContentPort {
  return { load: async (_userId, characterId) => mateDetailContent(await getMateDetail(client, characterId), characterId) }
}
