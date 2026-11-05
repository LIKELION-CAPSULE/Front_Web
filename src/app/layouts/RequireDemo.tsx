import { Navigate, Outlet, useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { RouteLoading } from '@/app/components/RouteLoading'

export function RequireDemo() {
  const { state } = useDemo()
  const location = useLocation()
  const backend = useBackend()
  if (backend.status === 'loading') return <RouteLoading />
  if (backend.status === 'error') return location.pathname === '/' ? <Outlet /> : <Navigate to="/" replace />
  const next = location.pathname + location.search + location.hash
  if (state.profile.loggedIn && !state.profile.onboarded && location.pathname !== '/onboarding') return <Navigate replace to={`/onboarding?next=${encodeURIComponent(next)}`} />
  return state.profile.loggedIn ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={backend.signedOutNotice
        ? `/login?notice=${backend.signedOutNotice}`
        : `/login?next=${encodeURIComponent(next)}`}
    />
  )
}
