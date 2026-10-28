import { NavLink, Outlet, useLocation } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'
import { useDemo } from '@/features/demo/demo-context'
import { Brand } from '@/shared/ui/Brand'
import { Icon, type IconName } from '@/shared/ui/Icon'

const navigation = [
  { to: '/', label: '홈', end: true, icon: 'home' },
  { to: '/records', label: '내 기록', end: false, icon: 'chart' },
  { to: '/characters', label: '친구', end: false, icon: 'heart' },
]

export function AppLayout() {
  const { storageAvailable } = useDemo()
  const { pathname } = useLocation()
  return (
    <div className="app-shell min-h-dvh bg-canvas">
      <PageNavigation />
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <div className="page-container app-header-inner">
          <NavLink to="/" aria-label="CAPSULE 홈" className="shrink-0">
            <Brand />
          </NavLink>
          <nav aria-label="주요 메뉴" className="app-navigation">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn('app-nav-item', isActive && 'is-active')}
              >
                <Icon name={item.icon as IconName} size={17} motion={item.icon === 'heart' ? 'pulse' : 'draw'} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <HeaderAccount studyTime={pathname === '/' ? 'desktop' : undefined} />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="page-container app-main focus:outline-none">
        {!storageAvailable && (
          <p role="status" className="mb-4 rounded-control bg-surface p-3 text-sm">
            브라우저 저장 공간을 사용할 수 없어 이번 방문 동안만 체험 내용이 유지돼요.
          </p>
        )}
        <Outlet />
      </main>
      <footer className="app-footer page-container">
        <span>
          CAPSULE <span className="mx-2 text-line">/</span> 같이 공부하는 시간의 힘.
        </span>
        <span>
          작은 집중이 쌓이는 곳 <span className="ml-3 text-brand">✦</span>
        </span>
      </footer>
    </div>
  )
}
