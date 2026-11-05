import { Outlet } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { AppNavigation } from '@/app/components/AppNavigation'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { AppFrame } from './AppFrame'

export function AppLayout() {
  const { storageAvailable } = useDemo()
  return (
    <AppFrame navigation={<AppNavigation />} account={<HeaderAccount />}>
      <PageNavigation />
      {!storageAvailable && (
        <FeedbackMessage tone="warning" className="mb-4 rounded-control bg-surface p-3">
          브라우저 저장 공간을 사용할 수 없어 이번 방문 동안만 체험 내용이 유지돼요.
        </FeedbackMessage>
      )}
      <Outlet />
    </AppFrame>
  )
}
