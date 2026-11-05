import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { Button } from '@/shared/ui/Button'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ServerAvatarPicker } from './ServerAvatarPicker'

export function ProfileEditor() {
  const { state } = useDemo()
  const { avatars, saveProfile } = useBackend()
  const currentAvatar = state.profile.avatarId ?? avatars.find(avatar => avatar.thumbnailUrl === state.profile.profileImage)?.id
  const [name, setName] = useState(state.profile.name)
  const [avatarId, setAvatarId] = useState(currentAvatar)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const changed = name.trim() !== state.profile.name || avatarId !== currentAvatar
  return <section aria-labelledby="profile-heading" className="mypage-profile">
    <div className="mypage-avatar-preview">{(avatars.find(value => value.id === avatarId)?.thumbnailUrl ?? state.profile.profileImage) && <img src={avatars.find(value => value.id === avatarId)?.thumbnailUrl ?? state.profile.profileImage} alt="내 아바타" className="h-80 w-full object-contain" />}</div>
    <form className="mypage-profile-form" onSubmit={async event => {
      event.preventDefault()
      if (busy || !changed) return
      setBusy(true); setError(''); setSaved(false)
      try { await saveProfile(name, avatarId); setName(name.trim()); setSaved(true) }
      catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요.') }
      finally { setBusy(false) }
    }}>
      <h2 id="profile-heading" className="type-section-title">프로필</h2>
      <FormField label="닉네임" className="mt-5"><input className="form-input" required maxLength={20} value={name} onChange={event => { setName(event.target.value); setSaved(false) }} /></FormField>
      <ServerAvatarPicker value={avatarId} onChange={value => { setAvatarId(value); setSaved(false) }} />
      <Button type="submit" className="mt-6" disabled={busy || !name.trim() || !changed}>{busy ? '저장하고 있어요…' : '프로필 저장'}</Button>
      {saved && <FeedbackMessage tone="success" className="mt-3">저장했어요.</FeedbackMessage>}
      {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
    </form>
  </section>
}
