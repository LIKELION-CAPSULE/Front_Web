import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { Avatar } from '@/shared/ui/Avatar'
import { useBackend } from '@/features/backend/backend-context'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { FloatingSurface } from '@/shared/ui/FloatingSurface'
import { MvpGate } from '@/features/mvp/MvpGate'

export function HeaderAccount() {
  const { state } = useDemo()
  const { logout } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
            <span className="font-sans tabular-nums text-body-compact font-bold text-ink">—</span>
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
            <p className="mb-2 border-b border-floating-hover px-3 py-2 text-body-compact font-bold">
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
            <button disabled={busy} onClick={async () => {
              setBusy(true); setError('')
              try { await logout() } catch (reason) { setError(reason instanceof Error ? reason.message : '로그아웃하지 못했어요.') }
              finally { setBusy(false) }
            }} className="menu-item">{busy ? '로그아웃 중…' : '로그아웃'}</button>
            {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
          </FloatingSurface>
        </details>
      </div>
    </>
  )
}
