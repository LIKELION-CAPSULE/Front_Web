import { NavLink, Outlet } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/Avatar'

const navigation = [
  { to: '/', label: '홈', end: true },
  { to: '/records', label: '내 기록', end: false },
  { to: '/characters', label: '캐릭터', end: false },
]

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-canvas">
      <PageNavigation />
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <header className="border-b border-divider">
        <div className="page-container flex min-h-16 flex-wrap items-center gap-x-7 gap-y-3 py-3 sm:gap-x-8 sm:py-0">
          <NavLink to="/" aria-label="CAPSULE 홈" className="font-mono text-lg leading-6 font-bold tracking-[3px]">
            CAPSULE
          </NavLink>
          <nav aria-label="주요 메뉴" className="order-3 flex w-full gap-5 sm:order-none sm:w-auto sm:gap-[22px]">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn('py-2 text-base leading-6 transition-colors hover:text-ink', isActive ? 'font-bold text-ink' : 'text-subtle')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 sm:gap-8">
            <NavLink to="/credits" className="flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-[13px] text-muted hover:border-brand">
              크레딧 <span className="font-mono text-sm font-bold text-ink">0</span>
            </NavLink>
            <span className="hidden min-w-[122px] rounded-full bg-surface px-3.5 py-1.5 text-sm leading-5 sm:inline-block">오늘 0분</span>
            <Avatar size="md" />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="page-container py-7 focus:outline-none">
        <Outlet />
      </main>
    </div>
  )
}
