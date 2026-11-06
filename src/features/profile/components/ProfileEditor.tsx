import { useEffect, useId, useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { Button } from '@/shared/ui/Button'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { AvatarDial } from './AvatarDial'

export function ProfileEditor({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const headingId = useId()
  const { state } = useDemo()
  const { avatars, saveProfile, ensureAvatars } = useBackend()
  // The choices load when the editor opens; without them only the current portrait is offered.
  useEffect(() => { void ensureAvatars().catch(() => { /* Keep the current avatar. */ }) }, [ensureAvatars])
  const currentAvatar = state.profile.avatarId ?? avatars.find(avatar => avatar.thumbnailUrl === state.profile.profileImage)?.id
  // Keep an existing custom/default portrait until the user explicitly chooses a server avatar.
  const choices = currentAvatar === undefined
    ? [{ id: 0, name: '현재 아바타', thumbnailUrl: state.profile.profileImage }, ...avatars]
    : avatars
  const [name, setName] = useState(state.profile.name)
  // Undefined until the user picks: the current avatar is only known once the choices have loaded.
  const [picked, setPicked] = useState<{ id: number | undefined }>()
  const avatarId = picked ? picked.id : currentAvatar
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = name.trim() !== state.profile.name || avatarId !== currentAvatar
  return <section aria-labelledby={headingId} className="profile-editor">
    <form className="profile-editor-form" onSubmit={async event => {
      event.preventDefault()
      if (busy || !changed) return
      setBusy(true); onBusyChange?.(true); setError('')
      try { await saveProfile(name, avatarId); setName(name.trim()) }
      catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요.') }
      finally { setBusy(false); onBusyChange?.(false) }
    }}>
      <h2 id={headingId} className="account-settings-title">프로필</h2>
      <AvatarDial compact avatars={choices} value={avatarId ?? 0} disabled={busy} onChange={value => setPicked({ id: value === 0 ? undefined : value })} fallback={<AvatarIllustration settings={state.profile.avatar} />} />
      <div className="profile-editor-details">
        <FormField label="닉네임"><input className="form-input" name="nickname" autoComplete="nickname" readOnly={busy} required maxLength={20} value={name} onChange={event => setName(event.target.value)} /></FormField>
        <Button type="submit" className="mt-4 w-full" loading={busy} disabled={busy || !name.trim() || !changed}>프로필 저장</Button>
        {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
      </div>
    </form>
  </section>
}
