import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { ServerAvatarPicker } from '@/features/profile/components/ServerAvatarPicker'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'
import { Brand } from '@/shared/ui/Brand'

export default function OnboardingPage() {
  const { state } = useDemo()
  const backend = useBackend()
  const [name, setName] = useState(state.profile.name)
  const [avatarId, setAvatarId] = useState(backend.avatars[0]?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  async function finish(selected?: number) {
    if (busy) return
    setBusy(true); setError('')
    try { await backend.saveProfile(name, selected); await backend.reload(); navigate(safeReturnPath(params.get('next'), '/'), { replace: true }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '프로필을 저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <main id="main-content" className="page-container max-w-3xl py-10">
    <Brand className="mb-10 w-40" />
    <h1 className="type-page-title">내 아바타를 골라요</h1>
    <p className="mt-3 text-muted">카메라를 끄면 선택한 아바타가 보여요.</p>
    <form className="mt-6" onSubmit={event => { event.preventDefault(); void finish(avatarId) }}>
      <FormField label="닉네임"><input className="form-input" required maxLength={20} value={name} onChange={event => setName(event.target.value)} /></FormField>
      <ServerAvatarPicker value={avatarId} onChange={setAvatarId} />
      {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy || !name.trim()} onClick={() => { void finish() }}>기본 아바타로 시작하기</Button>
        <Button type="submit" disabled={busy || !name.trim() || !avatarId}>{busy ? '저장하고 있어요…' : '이 모습으로 시작하기'}</Button>
      </div>
    </form>
  </main>
}
