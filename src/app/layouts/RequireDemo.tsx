import { Navigate, Outlet, useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'

export function RequireDemo() {
  const { state } = useDemo()
  const location = useLocation()
  return state.profile.loggedIn ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
    />
  )
}
