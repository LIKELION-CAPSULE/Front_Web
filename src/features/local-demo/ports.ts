import type { BetaFeaturePort } from '../backend/beta-feature-port'
import { LOCAL_USER_ID, type LocalBetaStore } from './store'

/**
 * Local-only UI port. Account (4 · 8 · 10 · 35 · 36 · 39), mate detail (31), credits (33 · 34) and attendance go
 * through the same server paths as production and are answered by the mock transport. This port only carries what the
 * local previews still inject: records, messages, affinities, the call screen's voice/advanced switches and the wallet
 * its credit pre-check reads (backend-context.ts `wallet`).
 */
export function createLocalPorts(store: LocalBetaStore) {
  const featurePort: BetaFeaturePort = {
    read: (userId) => {
      if (userId !== LOCAL_USER_ID) throw new Error('로컬 계정을 확인해 주세요.')
      return store.snapshot()
    },
    subscribe: store.subscribe,
    setSettings: store.setSettings,
  }
  return { featurePort }
}
