import { NavLink, Outlet } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'
import { useDemo } from '@/features/demo/demo-context'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { MvpGate } from '@/features/mvp/MvpGate'

const navigation = [
  { to: '/', label: '홈', end: true, icon: 'home' },
  { to: '/records', label: '내 기록', end: false, icon: 'chart' },
  { to: '/characters', label: '친구', end: false, icon: 'heart' },
]

export function AppLayout() {
  const { storageAvailable } = useDemo()
  return (
    <div className="app-shell min-h-dvh bg-canvas">
      <PageNavigation />
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <SiteHeader
        navigation={(
          <nav aria-label="주요 메뉴" className="app-navigation">
            {navigation.map((item) => (
              item.to !== '/' ? (
                <MvpGate key={item.to} label={item.label} className="mvp-nav" compact>
                  <span className="app-nav-item"><Icon name={item.icon as IconName} size={17} />{item.label}</span>
                </MvpGate>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn('app-nav-item', isActive && 'is-active')}
                >
                  <Icon name={item.icon as IconName} size={17} motion={item.icon === 'heart' ? 'pulse' : 'draw'} />
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>
        )}
        account={<HeaderAccount />}
      />
      <main id="main-content" tabIndex={-1} className="page-container app-main focus:outline-none">
        {!storageAvailable && (
          <FeedbackMessage tone="warning" className="mb-4 rounded-control bg-surface p-3">
            브라우저 저장 공간을 사용할 수 없어 이번 방문 동안만 체험 내용이 유지돼요.
          </FeedbackMessage>
        )}
        <Outlet />
      </main>
      <footer className="app-footer page-container">
        <span>
          CAPSULE <span className="mx-2 text-divider">/</span> 같이 공부하는 시간의 힘.
        </span>
        <span>
          작은 집중이 쌓이는 곳 <span className="ml-3 text-text-accent">✦</span>
        </span>
      </footer>
    </div>
  )
}
