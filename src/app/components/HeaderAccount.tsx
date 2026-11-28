import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { Link, useLocation, useNavigate } from 'react-router'
import { accountRequest, closeAccountRequest } from '@/features/profile/account-location'
import { Avatar } from '@/shared/ui/Avatar'
import { CloseButton } from '@/shared/ui/CloseButton'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { number } from '@/shared/lib/format'
import { useCreditDisplay, useServerCreditsRefresh } from '@/features/attendance/use-credit-display'
import { NotificationBell } from './NotificationBell'
import '@/features/profile/components/account-settings.css'

const AccountSettingsDialog = lazy(() => import('@/features/profile/components/AccountSettingsDialog'))

function AccountSettingsLoading({ onClose }: { onClose: () => void }) {
  return <Dialog open title="계정 설정" onClose={onClose} showHeader={false} showCloseButton={false} className="account-settings-dialog">
    <div className="account-settings-layout" aria-hidden="true" inert>
      <aside className="account-settings-sidebar"><div className="account-settings-identity"><div className="account-settings-avatar skeleton-line rounded-full" /><div className="skeleton-line h-6 w-28 rounded-control" /></div><hr className="account-settings-divider" /><div className="account-settings-menu">{['profile', 'settings', 'security'].map(view => <div key={view} data-account-view={view} className="account-settings-tab skeleton-line" />)}</div><div className="account-settings-footer"><div className="account-settings-tab skeleton-line" /></div></aside>
      <div className="account-settings-loading"><QuarterRingSpinner /></div>
    </div>
    <span role="status" data-account-loading className="sr-only">계정 설정을 불러오고 있어요.</span>
    <CloseButton className="account-settings-close" label="계정 설정 닫기" onClick={onClose} />
  </Dialog>
}

/**
 * The header's credit chip (a link to /credits): 「남은 크레딧」, the whole balance that can be spent now (server
 * `todayRemaining` = attendance + invitation; use-credit-display.ts), with the credit gold coin (design exception 2).
 * Its name carries the balance, so a screen reader hears the number and not only "크레딧". An attendance reward
 * landing here counts the number up and bounces the icon.
 */
function CreditChip({ value, landing }: ReturnType<typeof useCreditDisplay>) {
  const icon = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const bounced = useRef(landing?.id)
  useEffect(() => {
    if (!landing || landing.id === bounced.current || reduced || !icon.current) return
    bounced.current = landing.id
    const bounce = animate(icon.current, { scale: [1, 1.32, 1] }, { type: 'spring', stiffness: 520, damping: 14 })
    return () => bounce.stop()
  }, [landing, reduced])
  return <Link to="/credits" className="credit-chip" aria-label={`남은 크레딧 ${number(value ?? 0)}`} title="남은 크레딧" data-tour="credits">
    <span ref={icon} data-credit-target className="credit-coin inline-flex"><Icon name="coin" size={17} /></span>
    <span className="font-sans tabular-nums text-label font-semibold text-ink">{number(value ?? 0)}</span>
  </Link>
}

export function HeaderAccount() {
  const credits = useCreditDisplay()
  useServerCreditsRefresh()
  const [localOpen, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const requested = accountRequest(location.search)
  // The service tour opens this modal itself (`?tour=…&account=…`) and alone closes it (skip, Esc, its end).
  const tourOwned = requested !== null && new URLSearchParams(location.search).has('tour')
  const open = localOpen || requested !== null
  const trigger = useRef<HTMLButtonElement>(null)
  function close() {
    setOpen(false)
    if (requested) navigate({ pathname: location.pathname, search: closeAccountRequest(location.search), hash: location.hash }, { replace: true, preventScrollReset: true })
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <div className="header-account ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
      {credits.value !== null && <CreditChip {...credits} />}
      <NotificationBell />
      <button ref={trigger} type="button" data-tour="profile" aria-label="계정 설정 열기" aria-haspopup="dialog" aria-expanded={open} className="header-avatar-btn flex items-center justify-center rounded-full" onClick={() => setOpen(true)}><Avatar size="sm" /></button>
    </div>
    {open && <Suspense fallback={<AccountSettingsLoading onClose={close} />}><AccountSettingsDialog key={requested?.view ?? 'local'} initialView={requested?.view} locked={tourOwned} onClose={close} /></Suspense>}
  </>
}
