import { Navigate, useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { legacyBetaDestination } from '@/features/mates/legacy-destination'

export function BetaLegacyRedirect() {
  const { pathname } = useLocation()
  const { state } = useDemo()
  const { home, activeSummary } = useBackend()
  return <Navigate replace to={legacyBetaDestination(pathname, availableMates(home), state.activeSession, activeSummary, state.records)} state={null} />
}
