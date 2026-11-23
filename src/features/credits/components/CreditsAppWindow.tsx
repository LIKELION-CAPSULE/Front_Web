import { AppPanel } from '@/shared/ui/AppPanel'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/credits/credits-window.css'

export function CreditsAppWindow({
  activeTab,
  loadingScreen,
  children,
}: {
  activeTab: 'credits' | 'invite'
  loadingScreen?: 'credits' | 'invite'
  children: ReactNode
}) {
  return (
    <AppPanel title="내 크레딧" className="credits-window" loadingScreen={loadingScreen} bodyClassName="credits-window-body">
      <div className="credits-window-bar">
        <nav aria-label="크레딧 메뉴" className="credits-tab-nav">
          <Link
            to="/credits"
            className="credits-tab-link"
            aria-current={activeTab === 'credits' ? 'page' : undefined}
          >
            크레딧
          </Link>
          <Link
            to="/credits/charge"
            className="credits-tab-link"
            aria-current={activeTab === 'invite' ? 'page' : undefined}
          >
            친구 초대
          </Link>
        </nav>
      </div>

      <div className="credits-tab-content">{children}</div>
    </AppPanel>
  )
}
