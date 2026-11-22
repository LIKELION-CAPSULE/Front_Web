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
    <section
      className="credits-window desktop-window desktop-window--active"
      aria-labelledby="credits-window-title"
      data-loading-screen={loadingScreen}
    >
      <div className="desktop-window-titlebar mate-window-titlebar-static">
        <div className="desktop-window-title-left">
          <span id="credits-window-title" className="desktop-mate-title">
            CAPSULE — 내 크레딧
          </span>
        </div>
        <div className="desktop-window-title-right">
          <div className="desktop-window-controls" aria-hidden="true">
            <span className="desktop-window-dot" />
            <span className="desktop-window-dot" />
            <span className="desktop-window-dot" />
          </div>
        </div>
      </div>

      <div className="desktop-window-body credits-window-body">
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
      </div>
    </section>
  )
}
