import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { accountRequest, closeAccountRequest } from '@/features/profile/account-location'
import { Avatar } from '@/shared/ui/Avatar'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { useBackend } from '@/features/backend/backend-context'
import { number } from '@/shared/lib/format'
import '@/features/profile/components/account-settings.css'

const AccountSettingsDialog = lazy(() => import('@/features/profile/components/AccountSettingsDialog'))

function formatKoreanTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function MenuBarClock() {
  const [timeText, setTimeText] = useState(() => formatKoreanTime(new Date()))
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    const update = () => setTimeText(formatKoreanTime(new Date()))
    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 + 50
    const timeoutId = setTimeout(() => {
      update()
      intervalId = setInterval(update, 60_000)
    }, msUntilNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])
  return <span className="site-header-clock" aria-hidden="true">{timeText}</span>
}

function AccountSettingsLoading({ onClose }: { onClose: () => void }) {
  return <Dialog open title="계정 설정" onClose={onClose} showHeader={false} showCloseButton={false} className="account-settings-dialog">
    <div className="account-settings-layout" aria-hidden="true" inert>
      <aside className="account-settings-sidebar"><div className="account-settings-identity"><div className="account-settings-avatar skeleton-line rounded-full" /><div className="skeleton-line h-6 w-28 rounded-control" /></div><hr className="account-settings-divider" /><div className="account-settings-menu">{['profile', 'settings', 'security'].map(view => <div key={view} data-account-view={view} className="account-settings-tab skeleton-line" />)}</div><div className="account-settings-footer"><div className="account-settings-tab skeleton-line" /></div></aside>
      <div className="account-settings-loading"><QuarterRingSpinner /></div>
    </div>
    <span role="status" data-account-loading className="sr-only">계정 설정을 불러오고 있어요.</span>
    <button type="button" className="account-settings-close" aria-label="계정 설정 닫기" onClick={onClose}><Icon name="close" size={20} /></button>
  </Dialog>
}

export function HeaderAccount() {
  const { wallet } = useBackend()
  const [localOpen, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const requested = accountRequest(location.search)
  const open = localOpen || requested !== null
  const trigger = useRef<HTMLButtonElement>(null)
  function close() {
    setOpen(false)
    if (requested) navigate({ pathname: location.pathname, search: closeAccountRequest(location.search), hash: location.hash }, { replace: true, preventScrollReset: true })
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <div className="header-account ml-auto flex shrink-0 items-center gap-2 sm:gap-3.5">
      {wallet && (
        <Link to="/credits" className="credit-chip" aria-label="오늘 남은 크레딧">
          <Icon name="coin" size={14} />
          <span className="font-sans tabular-nums text-[13px] font-semibold text-ink">
            {number(wallet.attendance + wallet.invitation)}
          </span>
        </Link>
      )}
      <MenuBarClock />
      <button ref={trigger} type="button" aria-label="계정 설정 열기" aria-haspopup="dialog" aria-expanded={open} className="header-avatar-btn flex items-center justify-center rounded-full" onClick={() => setOpen(true)}><Avatar size="sm" /></button>
    </div>
    {open && <Suspense fallback={<AccountSettingsLoading onClose={close} />}><AccountSettingsDialog key={requested?.view ?? 'local'} initialView={requested?.view} onClose={close} /></Suspense>}
  </>
}
