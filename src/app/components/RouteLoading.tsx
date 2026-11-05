import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { resolveLoadingScreen } from '@/shared/lib/loading-screen'
import { AppLoading } from '@/shared/ui/AppLoading'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'

export function RouteLoading({ destination, label }: { destination?: string | null; label?: string } = {}) {
  const location = useLocation()
  const { status, loadingStage } = useBackend()
  const { state } = useDemo()
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname, destination])
  const screen = resolveLoadingScreen(destination === undefined ? location.pathname + location.search + location.hash : destination, {
    status, loadingStage, loggedIn: state.profile.loggedIn, onboarded: state.profile.onboarded,
  })
  return screen ? <PageSkeleton screen={screen} /> : <AppLoading label={label ?? (status === 'loading' && loadingStage === 'auth' ? '로그인 상태를 확인하고 있어요.' : undefined)} />
}
