import type { AffinityChange } from '@/shared/api/types'
import type { Message, StudyRecord } from '@/features/demo/types'
import type { BetaInvitation, BetaWallet } from '@/features/credits/beta-types'

/** UI operations only. No new backend endpoints are implied by this port. */
export type BetaFeatureSnapshot = {
  wallet: BetaWallet
  invitation: BetaInvitation
  records: StudyRecord[]
  messages: Message[]
  affinities: Record<string, AffinityChange>
  settings: { voice: boolean; advanced: boolean }
}
export type BetaFeaturePort = {
  read: (userId: number) => BetaFeatureSnapshot
  subscribe: (listener: () => void) => () => void
  redeemInvitation: (code: string) => Promise<void>
  setSettings: (settings: Partial<BetaFeatureSnapshot['settings']>) => void
}
