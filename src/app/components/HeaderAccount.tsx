import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { todaySeconds } from '@/features/demo/selectors'
import { cn } from '@/shared/lib/cn'
import { duration, number } from '@/shared/lib/format'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'

export function HeaderAccount({ studyTime }: { studyTime?: 'desktop' | 'always' }) {
  const { state, dispatch } = useDemo()
  const [resetOpen, setResetOpen] = useState(false)

  return (
    <>
      <div className="header-account ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
        <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-5">
          <NavLink to="/credits" className="credit-chip">
            <Icon name="coin" size={16} />
            <span className="sr-only">크레딧</span>
            <span className="font-mono text-sm font-bold text-ink">{number(state.credits)}</span>
          </NavLink>
          {studyTime && (
            <span
              className={cn(
                'header-study-time items-center gap-2 text-xs whitespace-nowrap text-muted',
                studyTime === 'desktop' ? 'hidden xl:flex' : 'flex',
              )}
            >
              <Icon name="clock" size={15} />
              오늘 {duration(todaySeconds(state))}
            </span>
          )}
        </div>
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
              {state.firstVisit ? '재방문 화면 보기' : '첫 방문 화면 보기'}
            </button>
            <button onClick={() => dispatch({ type: 'LOGOUT' })} className="menu-item">
              로그아웃
            </button>
            <button onClick={() => setResetOpen(true)} className="menu-item">
              체험 기록 초기화
            </button>
          </div>
        </details>
      </div>
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="체험 기록을 초기화할까요?"
      >
        <p className="mb-5 text-sm leading-6 text-muted">
          이 브라우저의 체험 데이터를 모두 지우고, 처음 제공된 샘플 데이터로 돌아가요.
        </p>
        <Button onClick={() => dispatch({ type: 'RESET', now: Date.now() })} className="w-full">
          초기화하기
        </Button>
      </Dialog>
    </>
  )
}
