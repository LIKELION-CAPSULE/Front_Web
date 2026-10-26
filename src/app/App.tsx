import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DetailLayout } from '@/app/layouts/DetailLayout'
import HomePage from '@/pages/HomePage'

const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'))
const RecordsPage = lazy(() => import('@/pages/RecordsPage'))
const CharactersPage = lazy(() => import('@/pages/CharactersPage'))
const CreditsPage = lazy(() => import('@/pages/CreditsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export function App() {
  return (
    <Suspense fallback={<p role="status" className="page-container py-12 text-muted">공부 공간을 불러오고 있어요…</p>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<DetailLayout />}>
          <Route path="rooms/:roomId" element={<RoomDetailPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
