import { AppPanel } from '@/shared/ui/AppPanel'
import type { ReactNode } from 'react'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/credits/credits-window.css'

/** Where 친구 초대 lives (SCR-31). The older /credits/charge and /invite still open it. */
export const INVITE_PATH = '/credits/invite'

/**
 * The frame shared by 내 크레딧 (SCR-30) and 친구 초대 (SCR-31).
 * `dashboard`: 내 크레딧 with its balance loaded draws its own title beside the balance card on the open page, so the
 * panel keeps the h1 for screen readers only and drops its surface.
 */
export function CreditsAppWindow({
  page,
  loadingScreen,
  dashboard = false,
  children,
}: {
  page: 'credits' | 'invite'
  loadingScreen?: 'credits' | 'invite'
  dashboard?: boolean
  children: ReactNode
}) {
  return (
    <AppPanel
      title={page === 'credits' ? '내 크레딧' : '친구 초대'}
      hideTitle={dashboard}
      className={dashboard ? 'credits-window credits-window--dashboard' : 'credits-window'}
      loadingScreen={loadingScreen}
      bodyClassName="credits-window-body"
    >
      {children}
    </AppPanel>
  )
}
