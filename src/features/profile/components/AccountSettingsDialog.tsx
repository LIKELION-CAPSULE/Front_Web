import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { ProfileEditor } from './ProfileEditor'
import { AccountSecurityPanel } from './AccountSecurityPanel'
import { ConnectionSettingsPanel } from './ConnectionSettingsPanel'
import '@/features/mates/mates.css'
import './account-settings.css'

const menus = [
  { id: 'profile', label: '프로필', icon: 'user' },
  { id: 'settings', label: '설정', icon: 'sliders' },
  { id: 'security', label: '보안', icon: 'lock' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[]
type AccountView = (typeof menus)[number]['id']

function AccountLogout({
  disabled,
  onBusyChange,
}: {
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const { logout } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function finish() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      await logout()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      pending.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <div className="account-settings-footer">
      {error && (
        <FeedbackMessage tone="error" className="mb-3">
          {error}
        </FeedbackMessage>
      )}
      <Button
        variant="ghost"
        size="md"
        className="account-settings-logout"
        disabled={disabled}
        loading={busy}
        onClick={() => {
          void finish()
        }}
        data-account-logout
      >
        <Icon name="arrow" size={18} className="rotate-180" />
        로그아웃
      </Button>
    </div>
  )
}

export default function AccountSettingsDialog({
  onClose,
  initialView = 'profile',
  locked = false,
}: {
  onClose: () => void
  initialView?: 'profile' | 'settings'
  /** Held open by the service tour: the backdrop and Esc do not close it (the tour closes it with itself). */
  locked?: boolean
}) {
  const { state } = useDemo()
  const prefix = useId()
  const [view, setView] = useState<AccountView>(initialView)
  const [busy, setBusy] = useState(false)
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 720 : false,
  )
  const windowRef = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = windowRef.current
    if (!node) return
    const update = (width: number) => {
      if (width > 0) setNarrow(width < 720)
    }
    update(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function selectView(next: AccountView, focusTab = false) {
    setView(next)
    main.current?.scrollTo({ top: 0 })
    // 보안 keeps the focus on its tab: the withdrawal field below is open from the start and must never take it.
    if (focusTab || next === 'security') {
      document.getElementById(`${prefix}-tab-${next}`)?.focus({ preventScroll: true })
    } else if (document.activeElement instanceof HTMLElement && document.activeElement.getAttribute('role') === 'tab') {
      document.activeElement.blur()
    }
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (busy) return
    const previous = narrow ? 'ArrowLeft' : 'ArrowUp'
    const next = narrow ? 'ArrowRight' : 'ArrowDown'
    let target: number
    if (event.key === previous) target = (index - 1 + menus.length) % menus.length
    else if (event.key === next) target = (index + 1) % menus.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = menus.length - 1
    else return
    event.preventDefault()
    const item = menus[target]!
    selectView(item.id, true)
  }

  return (
    <Dialog
      open
      title="계정 설정"
      onClose={onClose}
      showHeader={false}
      showCloseButton={false}
      dismissible={!busy && !locked}
      className="account-settings-dialog"
    >
      <div ref={windowRef} className="account-settings-window">
        <button type="button" disabled={busy} className="account-settings-close" aria-label="계정 설정 닫기" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>

        <div className="account-settings-layout">
          <aside className="account-settings-sidebar">
            <div className="account-settings-identity">
              <Avatar size="sm" className="account-settings-avatar" />
              <p className="account-settings-name" title={state.profile.name}>
                {state.profile.name}
              </p>
            </div>
            <hr className="account-settings-divider" />
            <div
              role="tablist"
              aria-label="계정 설정 메뉴"
              aria-orientation={narrow ? 'horizontal' : 'vertical'}
              className="account-settings-menu"
            >
              {menus.map((menu, index) => (
                <button
                  key={menu.id}
                  type="button"
                  role="tab"
                  id={`${prefix}-tab-${menu.id}`}
                  aria-selected={view === menu.id}
                  aria-controls={`${prefix}-panel-${menu.id}`}
                  tabIndex={view === menu.id ? 0 : -1}
                  disabled={busy}
                  data-account-view={menu.id}
                  data-dialog-initial-focus={menu.id === initialView || undefined}
                  className="account-settings-tab"
                  onClick={() => selectView(menu.id, false)}
                  onKeyDown={(event) => navigate(event, index)}
                >
                  <Icon name={menu.icon} size={18} />
                  <span>{menu.label}</span>
                </button>
              ))}
            </div>
            <AccountLogout disabled={busy} onBusyChange={setBusy} />
          </aside>

          <div
            className="account-settings-content"
            data-account-content={view}
          >
            <section
              role="tabpanel"
              id={`${prefix}-panel-profile`}
              aria-labelledby={`${prefix}-tab-profile`}
              hidden={view !== 'profile'}
              className="account-settings-panel account-settings-panel--profile"
            >
              <ProfileEditor
                active={view === 'profile'}
                onBusyChange={setBusy}
                narrowFooter={<AccountLogout disabled={busy} onBusyChange={setBusy} />}
              />
            </section>

            <div className="account-settings-main" hidden={view === 'profile'}>
              {/* The title stays above the scrolling rows, beside the close button, so nothing scrolls under the
                  button (the panels no longer carry their own title). */}
              <h2 className="account-settings-title account-settings-main-title">{view === 'security' ? '보안' : '설정'}</h2>
              <div ref={main} className="account-settings-main-scroll">
                <section
                  role="tabpanel"
                  id={`${prefix}-panel-settings`}
                  aria-labelledby={`${prefix}-tab-settings`}
                  hidden={view !== 'settings'}
                  className="account-settings-panel"
                >
                  {view === 'settings' && <ConnectionSettingsPanel />}
                </section>
                <section
                  role="tabpanel"
                  id={`${prefix}-panel-security`}
                  aria-labelledby={`${prefix}-tab-security`}
                  hidden={view !== 'security'}
                  className="account-settings-panel"
                >
                  {view === 'security' && <AccountSecurityPanel busy={busy} onBusyChange={setBusy} />}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
