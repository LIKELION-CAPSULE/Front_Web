import { Outlet } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { AppNavigation } from '@/app/components/AppNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ButtonLink } from '@/shared/ui/Button'
import { AppFrame } from './AppFrame'
import { useMatePrewarm } from '@/app/use-mate-prewarm'

export function AppLayout() {
  const { state, storageAvailable } = useDemo()
  // Idle desktop prewarm of the first mate's model for 내 메이트 / 메이트 상세 (use-mate-prewarm.ts).
  useMatePrewarm('model')
  return (
    <AppFrame navigation={<AppNavigation />} account={state.profile.loggedIn ? <HeaderAccount /> : <ButtonLink to="/login" size="sm" variant="secondary">로그인</ButtonLink>}>
      {!storageAvailable && (
        <FeedbackMessage tone="warning" className="mb-4 rounded-control bg-surface p-3">
          브라우저 저장 공간을 사용할 수 없어 이번 방문 동안만 기록이 유지돼요.
        </FeedbackMessage>
      )}
      <Outlet />
    </AppFrame>
  )
}
