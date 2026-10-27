import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useState } from 'react'
import { PageNavigation } from '@/app/PageNavigation'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/Avatar'
import { useDemo } from '@/features/demo/demo-context'
import { todaySeconds } from '@/features/demo/selectors'
import { duration, number } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Brand } from '@/shared/ui/Brand'
import { Icon, type IconName } from '@/shared/ui/Icon'

const navigation = [
  { to: '/', label: '홈', end: true, icon: 'home' },
  { to: '/records', label: '내 기록', end: false, icon: 'chart' },
  { to: '/characters', label: '캐릭터', end: false, icon: 'heart' },
]

export function AppLayout() {
  const { state, dispatch, storageAvailable } = useDemo()
  const { pathname } = useLocation()
  const [resetOpen, setResetOpen] = useState(false)
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
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <NavLink to="/credits" className="credit-chip">
              <Icon name="coin" size={16} />
              <span className="sr-only">크레딧</span>
              <span className="font-mono text-sm font-bold text-ink">{number(state.credits)}</span>
            </NavLink>
            {pathname === '/' && (
              <span className="hidden items-center gap-2 text-xs text-muted xl:flex">
                <Icon name="clock" size={15} />
                오늘 {duration(todaySeconds(state))}
              </span>
            )}
            <details className="relative z-30">
              <summary
                aria-label="내 프로필 메뉴"
                className="flex cursor-pointer list-none items-center gap-2 rounded-full"
              >
                <Avatar size="md" />
              </summary>
              <div className="absolute top-12 right-0 w-60 rounded-card bg-panel p-3 shadow-xl">
                <p className="border-b border-line px-3 py-2 text-sm font-bold">
                  {state.profile.name}
                </p>
                <Link
                  to="/mypage"
                  className="menu-item"
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open')
                  }}
                >
                  마이페이지
                </Link>
                <button
                  onClick={() => dispatch({ type: 'FIRST_VISIT', value: !state.firstVisit })}
                  className="menu-item"
                >
                  {state.firstVisit ? '이어하기 홈 보기' : '첫 방문 홈 보기'}
                </button>
                <button onClick={() => dispatch({ type: 'LOGOUT' })} className="menu-item">
                  로그아웃
                </button>
                <button onClick={() => setResetOpen(true)} className="menu-item">
                  데모 초기화
                </button>
              </div>
            </details>
          </div>
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
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="데모를 처음으로 돌릴까요?"
      >
        <p className="mb-5 text-sm leading-6 text-muted">
          이 브라우저에서 추가한 공부 기록·약속·크레딧 사용 내역을 지우고, 처음의 샘플 데이터로
          돌아가요.
        </p>
        <Button onClick={() => dispatch({ type: 'RESET', now: Date.now() })} className="w-full">
          초기화하기
        </Button>
      </Dialog>
    </div>
  )
}
