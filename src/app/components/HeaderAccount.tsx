import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { number } from '@/shared/lib/format'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { FloatingSurface } from '@/shared/ui/FloatingSurface'
import { MvpGate } from '@/features/mvp/MvpGate'

export function HeaderAccount() {
  const { state, dispatch } = useDemo()
  const [resetOpen, setResetOpen] = useState(false)
  const menuRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = menuRef.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <>
      <div className="header-account ml-auto flex shrink-0 items-center gap-2 sm:gap-5">
        <MvpGate label="내 크레딧 · 충전" compact inline>
          <span className="credit-chip">
            <Icon name="coin" size={16} />
            <span className="sr-only">크레딧</span>
            <span className="font-sans tabular-nums text-body-compact font-bold text-ink">{number(state.credits)}</span>
          </span>
        </MvpGate>
        <details
          ref={menuRef}
          className="relative z-30"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && event.currentTarget.open) {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.open = false
              event.currentTarget.querySelector('summary')?.focus()
            }
          }}
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
              event.currentTarget.open = false
            }
          }}
        >
          <summary
            aria-label="내 프로필 메뉴"
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full"
          >
            <Avatar size="md" />
          </summary>
          <FloatingSurface className="absolute top-12 right-0 w-60 rounded-card p-3">
            <p className="border-b border-floating-hover px-3 py-2 text-body-compact font-bold">
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
          </FloatingSurface>
        </details>
      </div>
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="체험 기록을 초기화할까요?"
      >
        <p className="mb-5 text-body-compact leading-6 text-muted">
          이 브라우저의 체험 데이터를 모두 지우고, 처음 제공된 샘플 데이터로 돌아가요.
        </p>
        <Button variant="danger-solid" onClick={() => dispatch({ type: 'RESET', now: Date.now() })} className="w-full">
          초기화하기
        </Button>
      </Dialog>
    </>
  )
}
