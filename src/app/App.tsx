import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { AuthPanelLayout } from '@/app/layouts/AuthPanelLayout'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DetailLayout } from '@/app/layouts/DetailLayout'
import { RequireDemo } from '@/app/layouts/RequireDemo'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import { RouteLoading } from '@/app/components/RouteLoading'
import { MobileAccessGate } from '@/app/components/MobileAccessGate'
import { AccountRedirect } from '@/app/components/AccountRedirect'
import { BetaLegacyRedirect } from '@/app/components/BetaLegacyRedirect'
import { PageNavigation } from '@/app/PageNavigation'
import { saveStoredReferralCode } from '@/features/auth/referral-code'
import { TourCallRoute, TourLayout } from '@/features/tour/TourLayout'

const RecordsPage = lazy(() => import('@/pages/RecordsPage'))
const CreditsPage = lazy(() => import('@/pages/CreditsPage'))
const InvitePage = lazy(() => import('@/pages/InvitePage'))
const MateDetailPage = lazy(() => import('@/pages/MateDetailPage'))
const ConnectionPage = lazy(() => import('@/pages/ConnectionPage'))
const MyMatesPage = lazy(() => import('@/pages/MyMatesPage'))
const ConnectionRecordPage = lazy(() => import('@/pages/ConnectionRecordPage'))
// Only /login uses the wake-up layout; onboarding / password reset have a plain panel shell.
const LoginLayout = lazy(() => import('@/features/auth/login-variants/LoginVariantLayout'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const KakaoCallbackPage = lazy(() => import('@/pages/KakaoCallbackPage'))
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'))

function isAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname === '/password/reset' ||
    pathname === '/reset-password'
  )
}

function isCreditsPath(pathname: string): boolean {
  const clean = pathname.replace(/\/$/, '') || '/'
  return clean === '/credits' || clean === '/credits/charge' || clean === '/invite'
}

/** Captures ?ref=<code> on any route entry, stores for 7 days in localStorage, and strips ref from URL. */
function ReferralLinkCapture() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const search = new URLSearchParams(location.search)
    const rawRef = search.get('ref')
    if (!rawRef) return
    saveStoredReferralCode(rawRef)
    search.delete('ref')
    navigate(
      {
        pathname: location.pathname,
        search: search.size ? `?${search}` : '',
        hash: location.hash,
      },
      { replace: true, state: location.state },
    )
  }, [location.pathname, location.search, location.hash, location.state, navigate])

  return null
}

export function App() {
  const location = useLocation()
  const suspenseKey = isAuthPath(location.pathname)
    ? 'auth'
    : isCreditsPath(location.pathname)
      ? 'credits'
      : location.pathname

  const content = (
    <div className={location.pathname === '/login' ? undefined : 'app-surface'}>
      <Suspense key={suspenseKey} fallback={<RouteLoading />}>
        <ReferralLinkCapture />
        <PageNavigation />
        <Routes>
          <Route element={<LoginLayout />}>
            <Route path="login" element={<LoginPage />} />
          </Route>
          <Route element={<AuthPanelLayout />}>
            <Route path="password/reset" element={<PasswordResetPage />} />
            <Route path="reset-password" element={<PasswordResetPage />} />
          </Route>
          <Route path="oauth/kakao" element={<KakaoCallbackPage />} />
          <Route element={<RequireDemo />}>
            <Route element={<AuthPanelLayout />}>
              <Route path="onboarding" element={<OnboardingPage />} />
            </Route>
            <Route path="mypage" element={<AccountRedirect />} />
            {/* The service tour (`?tour=<step>`) runs over these screens; see src/features/tour. */}
            <Route element={<TourLayout />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="records" element={<RecordsPage />} />
                <Route path="mates/me" element={<MyMatesPage />} />
                <Route path="credits" element={<CreditsPage />} />
                <Route path="credits/charge" element={<InvitePage />} />
                <Route path="invite" element={<InvitePage />} />
              </Route>
              <Route element={<DetailLayout />}>
                <Route path="mates/:mateId" element={<MateDetailPage />} />
                <Route path="connections/:connectionId" element={<ConnectionRecordPage />} />
              </Route>
              <Route path="tour/call/:mateId" element={<TourCallRoute />} />
            </Route>
            <Route path="connect/:mateId" element={<ConnectionPage />} />
            <Route path="rooms/:roomId" element={<BetaLegacyRedirect />} />
            <Route path="rooms/:roomId/prepare" element={<BetaLegacyRedirect />} />
            <Route path="study/:sessionId" element={<BetaLegacyRedirect />} />
            <Route path="reports/:recordId" element={<BetaLegacyRedirect />} />
            <Route path="capsules/:recordId" element={<BetaLegacyRedirect />} />
            <Route path="characters" element={<BetaLegacyRedirect />} />
            <Route path="characters/:characterId" element={<BetaLegacyRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  )
  return <MobileAccessGate>{content}</MobileAccessGate>
}
