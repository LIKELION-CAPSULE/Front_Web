import { createContext, useContext } from 'react'
import type { ActiveSession, Memory, StudyRecord, TierId } from '../demo/types'
import type { ActiveSessionSummary, AffinityChange, AvatarItem, HomeResponse, LoginResponse, MeResponse, MessageResponse, StartResponse, ResumeResponse, TermVersion } from '@/shared/api/types'
import type { LoadingStage } from '@/shared/lib/loading-screen'
import type { SessionModelStage } from '@/features/live2d/session-model'
import type { BetaInvitation, BetaWallet } from '@/features/credits/beta-types'
import type { BetaAccountDetails, BetaAccountPort, BetaOnboardingInput, BetaProfileInput } from '@/features/auth/beta-account'
import type { ReferralValidationResult } from '@/features/auth/referral-code'
import type { MateDetailContent } from '@/features/mates/mate-contract'
import type { MateServerRelationStats, MateUnlocks } from '@/features/mates/my-mates-utils'
import type { SessionModelFactory } from '@/features/live2d/session-model'
import type { BetaFeaturePort, BetaFeatureSnapshot } from './beta-feature-port'

export type BackendContextValue = {
  status: 'loading' | 'ready' | 'error'
  loadingStage: LoadingStage
  error: string | null
  signedOutNotice: 'account-withdrawn' | null
  me: MeResponse | null
  /** Memory only; null until the beta account contract has been connected. */
  accountDetails: BetaAccountDetails | null
  betaSignup: BetaAccountPort['signup'] | null
  completeOnboarding: ((input: BetaOnboardingInput) => Promise<void>) | null
  saveBetaProfile: ((input: BetaProfileInput) => Promise<void>) | null
  validateReferralCode: ((code: string) => Promise<ReferralValidationResult>) | null
  home: HomeResponse | null
  /** Client query invalidation only; not a field in the home API response. */
  homeContentVersion: number
  mateDetails: Record<string, MateDetailContent>
  mateContentVersion: number
  loadMateDetail: ((mateId: string, force?: boolean) => Promise<MateDetailContent>) | null
  resetMateConversation: ((mateId: string, revision: string) => Promise<void>) | null
  previewModelFactory: SessionModelFactory
  featurePort?: BetaFeaturePort
  betaSettings?: BetaFeatureSnapshot['settings']
  /** Null without a connected feature port; local previews inject an isolated wallet explicitly. */
  wallet: BetaWallet | null
  invitation: BetaInvitation | null
  mateUnlocks?: Record<string, MateUnlocks>
  mateRelationStats?: Record<string, MateServerRelationStats>
  redeemInvitation: ((code: string) => Promise<void>) | null
  activeSummary: ActiveSessionSummary | null
  avatars: AvatarItem[]
  terms: TermVersion[]
  visuals: StartResponse | ResumeResponse | null
  live2dStage: SessionModelStage | null
  affinities: Record<string, AffinityChange>
  updateAffinity: (characterId: number, value?: AffinityChange) => void
  refreshHome: () => Promise<void>
  /** Loads the avatar choices into `avatars` (cached). */
  ensureAvatars: () => Promise<void>
  reload: () => Promise<void>
  authenticate: (result: LoginResponse) => Promise<MeResponse>
  logout: () => Promise<void>
  withdrawAccount: () => Promise<void>
  forgetAuthentication: () => void
  saveProfile: (nickname: string, avatarId?: number) => Promise<void>
  createMemory: (input: Omit<Memory, 'id'>) => Promise<Memory>
  startSession: (roomId: string, characterId: string, minutes?: number, options?: { tier?: TierId; characterIds?: string[] }) => Promise<ActiveSession>
  connectMate: (mateId: string) => Promise<ActiveSession>
  resumeSession: (sessionId: string) => Promise<ActiveSession>
  /** `acceptUnknownPresence`: the user confirmed ending although earlier presence could not be restored. */
  finishSession: (options?: { acceptUnknownPresence?: boolean }) => Promise<StudyRecord>
  /** Clear only a connection the server has authoritatively reported as ended. Does not send /end again. */
  acknowledgeEndedSession: (sessionId: string, expectedUserId: number) => boolean
  sendMessage: (characterId: string, content: string, inputType?: 'TEXT' | 'QUICK') => Promise<MessageResponse>
  loadReport: (sessionId: string) => Promise<void>
}
export const BackendContext = createContext<BackendContextValue | null>(null)
export function useBackend() {
  const value = useContext(BackendContext)
  if (!value) throw new Error('BackendProvider is missing')
  return value
}
