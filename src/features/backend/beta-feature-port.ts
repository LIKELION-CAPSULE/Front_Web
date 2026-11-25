import type { AffinityChange } from '@/shared/api/types'
import type { Message, StudyRecord } from '@/features/demo/types'
import type { BetaInvitation, BetaWallet } from '@/features/credits/beta-types'
import type { MateUnlocks } from '@/features/mates/my-mates-utils'

/** UI operations only. No new backend endpoints are implied by this port. */
export type BetaFeatureSnapshot = {
  wallet: BetaWallet
  invitation: BetaInvitation
  records: StudyRecord[]
  messages: Message[]
  affinities: Record<string, AffinityChange>
  settings: { voice: boolean; advanced: boolean }
  /** Optional UI projection for mate unlocks (local preview / future server contract). */
  mateUnlocks?: Record<string, MateUnlocks>
}
export type BetaFeaturePort = {
  read: (userId: number) => BetaFeatureSnapshot
  subscribe: (listener: () => void) => () => void
  redeemInvitation: (code: string) => Promise<void>
  setSettings: (settings: Partial<BetaFeatureSnapshot['settings']>) => void
}
