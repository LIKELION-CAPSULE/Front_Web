import { useEffect, useId, useState } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { VerificationCodeInput } from '@/shared/ui/VerificationCodeInput'
import { useNow } from '@/features/session/use-now'
import { Button } from '@/shared/ui/Button'
import { api } from '@/shared/api/client'
import type { ExpiresResponse, VerificationResponse } from '@/shared/api/types'

export function EmailVerificationForm({ email, expiresAt: initialExpiresAt, onBack, onVerified }: {
  email: string
  expiresAt: number
  onBack: () => void
  onVerified: (token: string) => Promise<void>
}) {
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const id = useId()
  const now = useNow()
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  useEffect(() => { document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.focus() }, [])
  async function verify() {
    if (busy || code.length !== 6 || seconds === 0) return
    setBusy(true); setError('')
    try {
      const result = await api.request<VerificationResponse>('/auth/email/verification/confirm', { method: 'POST', auth: false, body: { email, code } })
      if (!result.verificationToken) throw new Error('인증 응답을 확인하지 못했어요.')
      await onVerified(result.verificationToken)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '인증하지 못했어요.') }
    finally { setBusy(false) }
  }
  async function resend() {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.request<ExpiresResponse>('/auth/email/verification', { method: 'POST', auth: false, body: { email } })
      if (!result.expiresInSeconds) throw new Error('인증 유효 시간을 확인하지 못했어요.')
      setExpiresAt(Date.now() + result.expiresInSeconds * 1000); setCode(''); setNotice('인증번호를 다시 보냈어요.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '재전송하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" disabled={busy} onClick={onBack} className="mt-4 min-h-11 text-body-compact text-muted">가입 정보 수정</button>
    <h1 tabIndex={-1} className="mt-3 type-page-title">이메일 인증</h1>
    <p className="mt-3 text-body-compact text-muted">이메일로 전송된 인증번호 6자리를 입력해 주세요.</p>
    <div className="mt-2 flex justify-between gap-3"><span className="break-all">{email}</span><span aria-label={`남은 시간 ${seconds}초`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
    <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void verify() }}>
      <VerificationCodeInput value={code} onChange={value => { setCode(value); setError('') }} readOnly={busy} invalid={!!error || seconds === 0} describedBy={error ? `${id}-error` : undefined} />
      {seconds === 0 && <FeedbackMessage tone="error">유효 시간이 지났어요. 인증번호를 다시 받아 주세요.</FeedbackMessage>}
      {error && <FeedbackMessage id={`${id}-error`} tone="error">{error}</FeedbackMessage>}
      {notice && <FeedbackMessage tone="info">{notice}</FeedbackMessage>}
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6 || seconds === 0}>{busy ? '확인하고 있어요…' : '인증하고 가입하기'}</Button>
      <button type="button" disabled={busy} onClick={() => { void resend() }} className="min-h-11 w-full text-text-accent underline">인증번호 다시 받기</button>
    </form>
  </>
}
