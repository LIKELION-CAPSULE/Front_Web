import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { AvatarDial } from '@/features/profile/components/AvatarDial'
import { SiteHeader } from '@/app/components/SiteHeader'
import { PageNavigation } from '@/app/PageNavigation'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationItem } from '@/shared/ui/notification-queue'
import { FormField } from '@/shared/ui/FormField'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import './onboarding.css'

export default function OnboardingPage() {
  const { state } = useDemo()
  const backend = useBackend()
  const [name, setName] = useState(state.profile.name)
  const [avatarId, setAvatarId] = useState(backend.avatars[0]?.id)
  const selectedAvatarId = avatarId !== undefined && backend.avatars.some(avatar => avatar.id === avatarId) ? avatarId : backend.avatars.find(avatar => avatar.id !== undefined)?.id
  const [busy, setBusy] = useState<'default' | 'selected' | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [params] = useSearchParams()
  const navigate = useNavigate()
  async function finish(selected?: number) {
    if (busy) return
    setBusy(selected === undefined ? 'default' : 'selected'); setNotifications([])
    try { await backend.saveProfile(name, selected); await backend.reload(); navigate(safeReturnPath(params.get('next'), '/'), { replace: true }) }
    catch (reason) {
      const item: NotificationItem = { id: crypto.randomUUID(), tone: 'error', title: '프로필 저장 실패', text: reason instanceof Error ? reason.message : '프로필을 저장하지 못했어요.' }
      setNotifications(current => enqueueNotification(current, item))
    }
    finally { setBusy(null) }
  }
  return <div className="onboarding-page avatar-background app-shell min-h-dvh">
    <PageNavigation />
    <SiteHeader navigation={null} account={null} />
    <main id="main-content" tabIndex={-1} className="page-container onboarding-main focus:outline-none">
      <h1 tabIndex={-1} className="onboarding-title type-page-title focus:outline-none">프로필 선택</h1>
      <form className="onboarding-form" onSubmit={event => { event.preventDefault(); if (selectedAvatarId !== undefined) void finish(selectedAvatarId) }}>
        <AvatarDial avatars={backend.avatars} value={selectedAvatarId} onChange={setAvatarId} disabled={!!busy} fallback={<AvatarIllustration settings={state.profile.avatar} />} />
        <div className="onboarding-details">
          <FormField label="닉네임"><input className="form-input" name="nickname" autoComplete="nickname" required maxLength={20} placeholder="닉네임을 입력해 주세요" readOnly={!!busy} value={name} onChange={event => setName(event.target.value)} /></FormField>
          <div className="onboarding-actions">
            <Button type="submit" loading={busy === 'selected'} disabled={!!busy || !name.trim() || selectedAvatarId === undefined} className="w-full">이 모습으로 시작하기</Button>
            <Button variant="ghost" size="sm" loading={busy === 'default'} disabled={!!busy || !name.trim()} onClick={() => { void finish() }} className="onboarding-default-action w-full">기본 아바타로 시작하기</Button>
          </div>
        </div>
      </form>
    </main>
    <NotificationStack items={notifications} onDismiss={id => setNotifications(current => current.filter(item => item.id !== id))} />
  </div>
}
