import { useId, useRef, useState } from 'react'
import { joinWaitlist } from '@/features/backend/server-api'
import { api, ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'

export const WAITLIST_COPY = {
  title: '베타 정원이 가득 찼어요',
  lead: '지금은 새로 가입할 수 없어요. 이메일을 남겨 주시면 자리가 생기거나 정식으로 출시될 때 알려 드릴게요.',
  emailLabel: '이메일',
  submit: '출시 알림 받기',
  done: '신청했어요. 출시되면 이 이메일로 알려 드릴게요.',
  invalidEmail: '이메일 주소를 확인해 주세요.',
  failed: '신청하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
} as const

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/**
 * The beta is full (4 · 6 answered 403 `BETA_FULL`): leave an email for the launch notice (45 `POST /beta/waitlist`, no
 * login). An email already on the list gets the same 204, so it reads as done too.
 */
export function BetaWaitlistForm({ defaultEmail = '', onBack }: { defaultEmail?: string; onBack: () => void }) {
  const fieldId = useId()
  const [email, setEmail] = useState(defaultEmail)
  const [fieldError, setFieldError] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const pending = useRef(false)

  async function submit() {
    if (pending.current || done) return
    const value = email.trim()
    if (!looksLikeEmail(value)) { setFieldError(WAITLIST_COPY.invalidEmail); return }
    pending.current = true
    setBusy(true); setError(''); setFieldError(undefined)
    try {
      await joinWaitlist(api, value)
      setDone(true)
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'INVALID_EMAIL') setFieldError(WAITLIST_COPY.invalidEmail)
      else setError(reason instanceof Error && reason.message ? reason.message : WAITLIST_COPY.failed)
    } finally { pending.current = false; setBusy(false) }
  }

  return (
    <form noValidate className="beta-waitlist" data-beta-waitlist onSubmit={event => { event.preventDefault(); void submit() }}>
      <h1 tabIndex={-1} className="type-page-title focus:outline-none">{WAITLIST_COPY.title}</h1>
      <p className="mt-3 text-body text-muted">{WAITLIST_COPY.lead}</p>
      <FormField className="mt-6" label={WAITLIST_COPY.emailLabel} error={fieldError} errorId={`${fieldId}-email`}>
        <input
          className="form-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          readOnly={busy || done}
          onChange={event => { setEmail(event.target.value); setFieldError(undefined); setError('') }}
          aria-invalid={!!fieldError || undefined}
          aria-describedby={fieldError ? `${fieldId}-email` : undefined}
        />
      </FormField>
      {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
      {done && <FeedbackMessage tone="success" className="mt-4">{WAITLIST_COPY.done}</FeedbackMessage>}
      <Button type="submit" className="mt-6 w-full" loading={busy} disabled={done}>{WAITLIST_COPY.submit}</Button>
      <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={onBack}>로그인으로 돌아가기</Button>
    </form>
  )
}
