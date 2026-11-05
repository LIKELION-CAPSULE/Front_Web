import { Navigate, Outlet, useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Button } from '@/shared/ui/Button'

export function RequireDemo() {
  const { state } = useDemo()
  const location = useLocation()
  const backend = useBackend()
  if (backend.status === 'loading') return <PageSkeleton />
  if (backend.status === 'error') return <main className="page-container py-12"><FeedbackMessage tone="error">{backend.error}</FeedbackMessage><Button className="mt-4" onClick={() => { void backend.reload() }}>다시 시도</Button></main>
  if (state.profile.loggedIn && !state.profile.onboarded && location.pathname !== '/onboarding') return <Navigate replace to="/onboarding" />
  return state.profile.loggedIn ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
    />
  )
}
