import { AppPanel } from '@/shared/ui/AppPanel'
import type { ReactNode } from 'react'
import { ButtonLink } from '@/shared/ui/Button'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/credits/credits-window.css'

/** Where 친구 초대 lives (SCR-31). The older /credits/charge and /invite still open it. */
export const INVITE_PATH = '/credits/invite'

/**
 * The frame shared by 내 크레딧 (SCR-30) and 친구 초대 (SCR-31): the page title, and on 내 크레딧 the 「친구 초대」
 * button where 「충전하기」 used to be (the beta sells nothing).
 */
export function CreditsAppWindow({
  page,
  loadingScreen,
  children,
}: {
  page: 'credits' | 'invite'
  loadingScreen?: 'credits' | 'invite'
  children: ReactNode
}) {
  return (
    <AppPanel
      title={page === 'credits' ? '내 크레딧' : '친구 초대'}
      action={page === 'credits' ? <ButtonLink to={INVITE_PATH} size="md">친구 초대</ButtonLink> : undefined}
      className="credits-window"
      loadingScreen={loadingScreen}
      bodyClassName="credits-window-body"
    >
      {children}
    </AppPanel>
  )
}
