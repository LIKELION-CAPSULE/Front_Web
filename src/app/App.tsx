import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DetailLayout } from '@/app/layouts/DetailLayout'
import { RequireDemo } from '@/app/layouts/RequireDemo'
import HomePage from '@/pages/HomePage'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'

const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'))
const RecordsPage = lazy(() => import('@/pages/RecordsPage'))
const CharactersPage = lazy(() => import('@/pages/CharactersPage'))
const CreditsPage = lazy(() => import('@/pages/CreditsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const PreparePage = lazy(() => import('@/pages/PreparePage'))
const StudyPage = lazy(() => import('@/pages/StudyPage'))
const ReportPage = lazy(() => import('@/pages/ReportPage'))
const CapsuleCardPage = lazy(() => import('@/pages/CapsuleCardPage'))
const ChargePage = lazy(() => import('@/pages/ChargePage'))
const GiftShopPage = lazy(() => import('@/pages/GiftShopPage'))

export function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireDemo />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="characters" element={<CharactersPage />} />
            <Route path="characters/:characterId" element={<CharactersPage />} />
            <Route path="characters/:characterId/shop" element={<GiftShopPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="credits/charge" element={<ChargePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="rooms/:roomId/prepare" element={<PreparePage />} />
          <Route path="study/:sessionId" element={<StudyPage />} />
          <Route path="reports/:recordId" element={<ReportPage />} />
          <Route path="capsules/:recordId" element={<CapsuleCardPage />} />
        </Route>
        <Route element={<DetailLayout />}>
          <Route path="rooms/:roomId" element={<RoomDetailPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
