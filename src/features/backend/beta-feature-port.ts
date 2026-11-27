import type { AffinityChange } from '@/shared/api/types'
import type { Message, StudyRecord } from '@/features/demo/types'
import type { BetaWallet } from '@/features/credits/beta-types'

/**
 * Local and review previews only (production passes none). Credits, invitation and attendance are not here: those
 * screens read the server API (33 · 34 · 35 · 36 · 39), which the local mock answers. `wallet` stays for the call
 * screen's and the connection record's credit pre-checks only (backend-context.ts).
 */
export type BetaFeatureSnapshot = {
  wallet: BetaWallet
  records: StudyRecord[]
  messages: Message[]
  affinities: Record<string, AffinityChange>
  settings: { voice: boolean; advanced: boolean }
}
export type BetaFeaturePort = {
  read: (userId: number) => BetaFeatureSnapshot
  subscribe: (listener: () => void) => () => void
  setSettings: (settings: Partial<BetaFeatureSnapshot['settings']>) => void
}
