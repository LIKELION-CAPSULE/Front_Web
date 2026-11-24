import type { BetaAccountPort } from '../auth/beta-account'
import { simulateMockReferralValidation } from '../auth/referral-code'
import type { MateContentPort } from '../mates/mate-contract'
import type { BetaFeaturePort } from '../backend/beta-feature-port'
import {
  LOCAL_USER_ID,
  LOCAL_V2_ENGINE_URL,
  LOCAL_V2_MODEL_URL,
  LOCAL_V2_PLAYER_URL,
  LOCAL_V2_REACTIONS_URL,
  type LocalBetaStore,
} from './store'
import { MOCK_AVATAR_URLS } from '../review/mock-avatars'

export function createLocalPorts(store: LocalBetaStore) {
  let failedProfile = false
  const images = MOCK_AVATAR_URLS
  const me = () => store.me(images[(store.data.avatarId ?? 990401) - 990401] ?? images[0])
  const accountPort: BetaAccountPort = {
    read: async () => ({ ...store.data.details }),
    validateReferralCode: async (code) =>
      simulateMockReferralValidation(code, {
        alreadyRegistered: Boolean(store.data.details.referralRegistered),
        ownCode: store.data.invitation.code,
      }),
    signup: async (input) => {
      store.reset('empty')
      store.data.details.birthDate = input.birthDate
      if (input.referralCode) {
        const check = simulateMockReferralValidation(input.referralCode, {
          ownCode: store.data.invitation.code,
        })
        if (check.valid) {
          store.data.details.referralRegistered = true
          store.data.invitation.canRedeem = false
        }
      }
      store.profile(input.nickname)
      store.data.onboardingRequired = true
      return store.login()
    },
    completeOnboarding: async (_userId, input) => {
      store.data.details.birthDate = input.birthDate ?? store.data.details.birthDate
      if (input.referralCode && !store.data.details.referralRegistered) {
        const check = simulateMockReferralValidation(input.referralCode, {
          ownCode: store.data.invitation.code,
        })
        if (check.valid) {
          store.data.details.referralRegistered = true
          store.data.invitation.canRedeem = false
        }
      }
      store.profile(input.nickname, input.avatarId)
      return { me: me(), details: { ...store.data.details } }
    },
    saveProfile: async (_userId, input) => {
      if (store.data.scenario === 'failure' && !failedProfile) {
        failedProfile = true
        throw new Error('요청을 처리하지 못했어요. 다시 시도해 주세요.')
      }
      store.data.details.callName = input.callName
      store.data.details.aboutMe = input.aboutMe
      store.profile(input.nickname, input.avatarId)
      return { me: me(), details: { ...store.data.details } }
    },
  }
  const matePort: MateContentPort = {
    load: async (_userId, characterId) => ({
      characterId,
      // Mate previews use the v2 (Aliving2D) model; the connection screen keeps the Cubism model (transport.ts).
      model: {
        format: 'aliving2d',
        modelJsonUrl: LOCAL_V2_MODEL_URL,
        engineUrl: LOCAL_V2_ENGINE_URL,
        playerUrl: LOCAL_V2_PLAYER_URL,
        reactionsUrl: LOCAL_V2_REACTIONS_URL,
      },
    }),
  }
  const featurePort: BetaFeaturePort = {
    read: (userId) => {
      if (userId !== LOCAL_USER_ID) throw new Error('로컬 계정을 확인해 주세요.')
      const snapshot = store.snapshot()
      snapshot.invitation.url = new URL(snapshot.invitation.url, location.origin).href
      return snapshot
    },
    subscribe: store.subscribe,
    redeemInvitation: async (code) => {
      await store.redeemInvitation(code)
      store.data.details.referralRegistered = true
      store.changed()
    },
    setSettings: store.setSettings,
  }
  return { accountPort, matePort, featurePort }
}
