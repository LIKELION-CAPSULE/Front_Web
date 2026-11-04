import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DetailLayout } from '@/app/layouts/DetailLayout'
import { RequireDemo } from '@/app/layouts/RequireDemo'
import HomePage from '@/pages/HomePage'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'
import MvpUnavailablePage from '@/pages/MvpUnavailablePage'

const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const MyPage = lazy(() => import('@/pages/MyPage'))
const PreparePage = lazy(() => import('@/pages/PreparePage'))
const StudyPage = lazy(() => import('@/pages/StudyPage'))
const ReportPage = lazy(() => import('@/pages/ReportPage'))
const CapsuleCardPage = lazy(() => import('@/pages/CapsuleCardPage'))
const KakaoCallbackPage = lazy(() => import('@/pages/KakaoCallbackPage'))
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'))

export function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="password/reset" element={<PasswordResetPage />} />
        <Route path="reset-password" element={<PasswordResetPage />} />
        <Route path="oauth/kakao" element={<KakaoCallbackPage />} />
        <Route element={<RequireDemo />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="records" element={<MvpUnavailablePage />} />
            <Route path="mypage" element={<MyPage />} />
            <Route path="characters/*" element={<MvpUnavailablePage />} />
            <Route path="credits/*" element={<MvpUnavailablePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="rooms/:roomId/prepare" element={<PreparePage />} />
          <Route path="study/:sessionId" element={<StudyPage />} />
          <Route path="reports/:recordId" element={<ReportPage />} />
          <Route path="capsules/:recordId" element={<CapsuleCardPage />} />
        </Route>
        <Route element={<RequireDemo />}>
          <Route element={<DetailLayout />}>
            <Route path="rooms/:roomId" element={<RoomDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
