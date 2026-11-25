import { createContext, useContext } from 'react'
import type { ActiveSession, Memory, StudyRecord, TierId } from '../demo/types'
import type { ActiveConnectionSummary, AffinityChange, ConnectionTotals, EndType, AvatarItem, HomeResponse, LoginResponse, MeResponse, MessageResponse, MessageStreamAudio, MessageStreamAudioEnd, StartResponse, ResumeResponse, TermVersion } from '@/shared/api/types'
import type { LoadingStage } from '@/shared/lib/loading-screen'
import type { SessionModelStage } from '@/features/live2d/session-model'
import type { BetaInvitation, BetaWallet } from '@/features/credits/beta-types'
import type { BetaAccountDetails, BetaAccountPort, BetaOnboardingInput, BetaProfileInput } from '@/features/auth/beta-account'
import type { ReferralValidationResult } from '@/features/auth/referral-code'
import type { MateDetailContent } from '@/features/mates/mate-contract'
import type { SessionModelFactory } from '@/features/live2d/session-model'
import type { BetaFeaturePort, BetaFeatureSnapshot } from './beta-feature-port'

/** The conversation mode of a connection (T-7): BASIC 0 · ADVANCED 30 credits a turn. */
/** The voice side of a message (28 `tts`, `audio`, `audio_end`). */
export type MessageVoice = { tts: boolean; onAudio?: (audio: MessageStreamAudio) => void; onAudioEnd?: (end: MessageStreamAudioEnd) => void; onClose?: () => void }

export type ConnectionModeChoice = 'basic' | 'advanced'

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
  /** 47 대화 초기화 (204). 409 `CONNECTION_IN_PROGRESS` while this mate is connected. */
  resetMateConversation: ((mateId: string) => Promise<void>) | null
  previewModelFactory: SessionModelFactory
  featurePort?: BetaFeaturePort
  betaSettings?: BetaFeatureSnapshot['settings']
  /** Null without a connected feature port; local previews inject an isolated wallet explicitly. */
  wallet: BetaWallet | null
  invitation: BetaInvitation | null
  redeemInvitation: ((code: string) => Promise<void>) | null
  /** 8 · 11 `activeConnection`: a connection to continue (17), when not running on this screen. */
  activeSummary: ActiveConnectionSummary | null
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
  /**
   * API 22. `endType` defaults to `NORMAL` (`AUTO_AWAY` after 10 minutes away or idle, `MINOR_LIMIT` at the under-19 limit).
   * `totals` only for a connection whose call screen never opened (no measurement running): a pickup cancelled on the
   * way in (use-connect-mate.ts) ends it with zero totals.
   */
  finishSession: (options?: { acceptUnknownPresence?: boolean; endType?: EndType; totals?: ConnectionTotals }) => Promise<StudyRecord>
  /** Clear only a connection the server has authoritatively reported as ended. Does not send /end again. */
  acknowledgeEndedSession: (sessionId: string, expectedUserId: number) => boolean
  /**
   * API 28. With `voice.tts` the reply asks for voice; its mp3 pieces go to `voice` (also after this resolves at
   * `done`), and `onClose` says the stream is over.
   */
  sendMessage: (characterId: string, content: string, inputType?: 'TEXT' | 'QUICK', voice?: MessageVoice) => Promise<MessageResponse>
  loadReport: (sessionId: string) => Promise<void>
  /** The running connection's conversation mode, sent with every message (20 · 28 `mode`). */
  connectionMode: ConnectionModeChoice
  setConnectionMode: (mode: ConnectionModeChoice) => void
  /** Registers work to finish before signing out (at most 2 s each); returns the unregister function. */
  onBeforeSignOut: (task: () => Promise<unknown>) => () => void
}
export const BackendContext = createContext<BackendContextValue | null>(null)
export function useBackend() {
  const value = useContext(BackendContext)
  if (!value) throw new Error('BackendProvider is missing')
  return value
}
