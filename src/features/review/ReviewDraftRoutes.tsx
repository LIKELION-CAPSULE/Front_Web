import { Route, Routes } from 'react-router'
import { App } from '@/app/App'
import { AppLayout } from '@/app/layouts/AppLayout'
import RecordsPage from '@/pages/RecordsPage'
import CharactersPage from '@/pages/CharactersPage'
import CreditsPage from '@/pages/CreditsPage'
import ChargePage from '@/pages/ChargePage'
import GiftShopPage from '@/pages/GiftShopPage'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { AppLoading } from '@/shared/ui/AppLoading'

/** Wait for the review image to load before opening the study preview. */
export function ReviewStudyGate() {
  const { state } = useDemo()
  return state.activeSession ? <App /> : <AppLoading label="캐릭터를 불러오고 있어요." />
}

/** These source pages are retained for copy review; production routes stay gated. */
export function ReviewDraftRoutes() {
  const { state } = useDemo()
  // A source page may assume legacy IDs exist; wait until ReviewSetup installs its own data.
  if (!state.profile.loggedIn || !getStudyRooms().some(room => room.id === 'dawn-library')) return <AppLoading />
  return <Routes>
    <Route element={<AppLayout />}>
      <Route path="records" element={<RecordsPage />} />
      <Route path="characters/:characterId" element={<CharactersPage />} />
      <Route path="characters/:characterId/shop" element={<GiftShopPage />} />
      <Route path="credits" element={<CreditsPage />} />
      <Route path="credits/charge" element={<ChargePage />} />
    </Route>
    <Route path="*" element={<App />} />
  </Routes>
}
