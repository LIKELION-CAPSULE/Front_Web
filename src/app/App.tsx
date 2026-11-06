import { lazy, Suspense, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DetailLayout } from '@/app/layouts/DetailLayout'
import { RequireDemo } from '@/app/layouts/RequireDemo'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import { RouteLoading } from '@/app/components/RouteLoading'
import { AccountRedirect } from '@/app/components/AccountRedirect'
import MvpUnavailablePage from '@/pages/MvpUnavailablePage'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { prepareBackground, prepareRoomId } from '@/features/session/prepare-location'
import { loadStudyPage, preparedStudyPage } from './study-page-loader'

const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const PreparePage = lazy(() => import('@/pages/PreparePage'))
const LazyStudyPage = lazy(loadStudyPage)
const ReportPage = lazy(() => import('@/pages/ReportPage'))
const CapsuleCardPage = lazy(() => import('@/pages/CapsuleCardPage'))
const KakaoCallbackPage = lazy(() => import('@/pages/KakaoCallbackPage'))
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'))

function StudyPage() {
  // Keep one component type for this route's lifetime, including direct visits that use Suspense.
  const [Page] = useState(() => preparedStudyPage() ?? LazyStudyPage)
  return <Page />
}

export function App() {
  const location = useLocation()
  const { state } = useDemo()
  const { status } = useBackend()
  const roomId = prepareRoomId(location.pathname)
  const background = roomId && status === 'ready' && state.profile.loggedIn && state.profile.onboarded
    ? prepareBackground(location.state) ?? { ...location, pathname: `/rooms/${roomId}`, search: '', hash: '', state: null }
    : null
  return (
    <>
      <Suspense key={background?.pathname ?? location.pathname} fallback={<RouteLoading />}>
        <Routes location={background ?? location}>
          <Route path="login" element={<LoginPage />} />
          <Route path="password/reset" element={<PasswordResetPage />} />
          <Route path="reset-password" element={<PasswordResetPage />} />
          <Route path="oauth/kakao" element={<KakaoCallbackPage />} />
          <Route element={<RequireDemo />}>
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="mypage" element={<AccountRedirect />} />
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="records" element={<MvpUnavailablePage />} />
              <Route path="characters/*" element={<MvpUnavailablePage />} />
              <Route path="credits/*" element={<MvpUnavailablePage />} />
            </Route>
            <Route path="rooms/:roomId/prepare" element={<PreparePage />} />
            <Route path="study/:sessionId" element={<StudyPage />} />
            <Route path="reports/:recordId" element={<ReportPage />} />
            <Route path="capsules/:recordId" element={<CapsuleCardPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<RequireDemo />}>
            <Route element={<DetailLayout />}>
              <Route path="rooms/:roomId" element={<RoomDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      {background && <Suspense fallback={null}>
        <Routes>
          <Route element={<RequireDemo />}>
            <Route path="rooms/:roomId/prepare" element={<PreparePage />} />
          </Route>
        </Routes>
      </Suspense>}
    </>
  )
}
