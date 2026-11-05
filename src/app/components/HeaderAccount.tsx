import { lazy, Suspense, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { accountRequest, closeAccountRequest } from '@/features/profile/account-location'
import { Avatar } from '@/shared/ui/Avatar'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { MvpGate } from '@/features/mvp/MvpGate'
import '@/features/profile/components/account-settings.css'

const AccountSettingsDialog = lazy(() => import('@/features/profile/components/AccountSettingsDialog'))

function AccountSettingsLoading({ onClose }: { onClose: () => void }) {
  return <Dialog open title="계정 설정" onClose={onClose} showHeader={false} showCloseButton={false} className="account-settings-dialog">
    <div className="account-settings-layout" aria-hidden="true" inert>
      <aside className="account-settings-sidebar"><div className="account-settings-identity"><div className="account-settings-avatar skeleton-line rounded-full" /><div className="skeleton-line h-6 w-28 rounded-control" /></div><hr className="account-settings-divider" /><div className="account-settings-menu">{['profile', 'schedule', 'security'].map(view => <div key={view} data-account-view={view} className="account-settings-tab skeleton-line" />)}</div><div className="account-settings-footer"><div className="account-settings-tab skeleton-line" /></div></aside>
      <div className="account-settings-loading"><QuarterRingSpinner /></div>
    </div>
    <span role="status" data-account-loading className="sr-only">계정 설정을 불러오고 있어요.</span>
    <button type="button" className="account-settings-close" aria-label="계정 설정 닫기" onClick={onClose}><Icon name="close" size={20} /></button>
  </Dialog>
}

export function HeaderAccount() {
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
    <div className="header-account ml-auto flex shrink-0 items-center gap-2 sm:gap-5">
      <MvpGate label="내 크레딧 · 충전" compact inline>
        <span className="credit-chip"><Icon name="coin" size={16} /><span className="sr-only">크레딧</span><span className="font-sans tabular-nums text-body-compact font-bold text-ink">—</span></span>
      </MvpGate>
      <button ref={trigger} type="button" aria-label="계정 설정 열기" aria-haspopup="dialog" aria-expanded={open} className="flex min-h-11 min-w-11 items-center justify-center rounded-full" onClick={() => setOpen(true)}><Avatar size="md" /></button>
    </div>
    {open && <Suspense fallback={<AccountSettingsLoading onClose={close} />}><AccountSettingsDialog key={requested ? `${requested.view}:${requested.openEditor}` : 'local'} initialView={requested?.view} openScheduleEditor={requested?.openEditor} onClose={close} /></Suspense>}
  </>
}
