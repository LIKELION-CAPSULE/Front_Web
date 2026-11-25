import type { BetaFeaturePort } from '../backend/beta-feature-port'
import { LOCAL_USER_ID, type LocalBetaStore } from './store'

/**
 * Local-only UI port. Account (4 · 8 · 10 · 35 · 36 · 39) and mate detail (31) go through the same server ports as
 * production (backend/server-ports.ts) and are answered by the mock transport. The feature port keeps the credit and
 * invitation screens' current local wallet until those screens are connected to 33 · 34 · 35 · 36 (server-api.ts).
 */
export function createLocalPorts(store: LocalBetaStore) {
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
  return { featurePort }
}
