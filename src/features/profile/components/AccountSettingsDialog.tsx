import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { ScheduleManager } from '@/features/schedule/components/ScheduleManager'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { ProfileEditor } from './ProfileEditor'
import { AccountSecurityPanel } from './AccountSecurityPanel'
import '../account-content.css'
import './account-settings.css'
import './avatar-background.css'

const mobileQuery = '(max-width: 639px)'
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches
function subscribeMobile(notify: () => void) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

const menus = [
  { id: 'profile', label: '프로필', icon: 'user' },
  { id: 'schedule', label: '일정', icon: 'calendar' },
  { id: 'security', label: '보안', icon: 'lock' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[]
type AccountView = typeof menus[number]['id']

function AccountLogout({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const { logout } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function finish() {
    if (pending.current) return
    pending.current = true
    setBusy(true); onBusyChange(true); setError('')
    try { await logout() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '로그아웃하지 못했어요. 다시 시도해 주세요.') }
    finally { pending.current = false; setBusy(false); onBusyChange(false) }
  }
  return <div className="account-settings-footer">
    {error && <FeedbackMessage tone="error" className="mb-3">{error}</FeedbackMessage>}
    <Button variant="ghost" size="md" className="account-settings-logout" disabled={disabled} loading={busy} onClick={() => { void finish() }} data-account-logout><Icon name="arrow" size={19} className="rotate-180" />로그아웃</Button>
  </div>
}

export default function AccountSettingsDialog({ onClose, initialView = 'profile', openScheduleEditor = false }: { onClose: () => void; initialView?: 'profile' | 'schedule'; openScheduleEditor?: boolean }) {
  const { state } = useDemo()
  const prefix = useId()
  const [view, setView] = useState<AccountView>(initialView)
  const [busy, setBusy] = useState(false)
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false)
  const main = useRef<HTMLDivElement>(null)

  function selectView(next: AccountView) {
    setView(next)
    main.current?.scrollTo({ top: 0 })
    document.getElementById(`${prefix}-tab-${next}`)?.focus()
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (busy) return
    const previous = mobile ? 'ArrowLeft' : 'ArrowUp'
    const next = mobile ? 'ArrowRight' : 'ArrowDown'
    let target: number
    if (event.key === previous) target = (index - 1 + menus.length) % menus.length
    else if (event.key === next) target = (index + 1) % menus.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = menus.length - 1
    else return
    event.preventDefault()
    const item = menus[target]!
    selectView(item.id)
  }

  return <Dialog open title="계정 설정" onClose={onClose} showHeader={false} showCloseButton={false} dismissible={!busy} className="account-settings-dialog">
    <div className="account-settings-layout">
      <aside className="account-settings-sidebar">
        <div className="account-settings-identity">
          <Avatar size="lg" className="account-settings-avatar" />
          <p className="account-settings-name" title={state.profile.name}>{state.profile.name}</p>
        </div>
        <hr className="account-settings-divider" />
        <div role="tablist" aria-label="계정 설정 메뉴" aria-orientation={mobile ? 'horizontal' : 'vertical'} className="account-settings-menu">
          {menus.map((menu, index) => <button key={menu.id} type="button" role="tab" id={`${prefix}-tab-${menu.id}`} aria-selected={view === menu.id} aria-controls={`${prefix}-panel-${menu.id}`} tabIndex={view === menu.id ? 0 : -1} disabled={busy} data-account-view={menu.id} data-dialog-initial-focus={menu.id === initialView || undefined} className="account-settings-tab" onClick={() => selectView(menu.id)} onKeyDown={event => navigate(event, index)}>
            <Icon name={menu.icon} size={19} />
            <span>{menu.label}</span>
          </button>)}
        </div>
        <AccountLogout disabled={busy} onBusyChange={setBusy} />
      </aside>
      <div className={`account-settings-content${view === 'profile' ? ' avatar-background' : ''}`} data-account-content={view}>
        <div ref={main} className="account-settings-main">
          <section role="tabpanel" id={`${prefix}-panel-profile`} aria-labelledby={`${prefix}-tab-profile`} hidden={view !== 'profile'} className="account-settings-panel">
            <ProfileEditor onBusyChange={setBusy} />
          </section>
          <section role="tabpanel" id={`${prefix}-panel-schedule`} aria-labelledby={`${prefix}-tab-schedule`} hidden={view !== 'schedule'} className="account-settings-panel account-settings-schedule">
            <h2 className="account-settings-title">일정</h2>
            <ScheduleManager id={`${prefix}-schedule`} initialEditorOpen={openScheduleEditor} onBusyChange={setBusy} />
          </section>
          <section role="tabpanel" id={`${prefix}-panel-security`} aria-labelledby={`${prefix}-tab-security`} hidden={view !== 'security'} className="account-settings-panel">
            {view === 'security' && <AccountSecurityPanel busy={busy} onBusyChange={setBusy} />}
          </section>
        </div>
      </div>
    </div>
    <button type="button" disabled={busy} className="account-settings-close" aria-label="계정 설정 닫기" onClick={onClose}><Icon name="close" size={20} /></button>
  </Dialog>
}
