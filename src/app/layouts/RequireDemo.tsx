import { useLayoutEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { RouteLoading } from '@/app/components/RouteLoading'
import { mateWarmPool } from '@/features/mate-render/warm-pool'
import { accountEnded, accountKey } from '@/features/mate-render/warm-renderer'

export function RequireDemo() {
  const { state } = useDemo()
  const location = useLocation()
  const backend = useBackend()
  // Logout, withdrawal or an expired session: drop the warm mate model at once. This guard stays mounted while it
  // swaps the screens for <Navigate>, and its layout effect runs before the unmounted previews' cleanups, which the
  // pool then refuses (older generation).
  const account = accountKey(state.profile)
  const lastAccount = useRef(account)
  useLayoutEffect(() => {
    if (accountEnded(lastAccount.current, account)) mateWarmPool.invalidate()
    lastAccount.current = account
  }, [account])
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
