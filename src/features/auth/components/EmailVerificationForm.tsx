import { useEffect, useId, useRef, useState } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { VerificationCodeInput } from '@/shared/ui/VerificationCodeInput'
import { useNow } from '@/features/session/use-now'
import { Icon } from '@/shared/ui/Icon'
import { Button } from '@/shared/ui/Button'
import { api } from '@/shared/api/client'
import type { ExpiresResponse, VerificationResponse } from '@/shared/api/types'

const resendCooldownMs = 30_000

export function EmailVerificationForm({ email, expiresAt: initialExpiresAt, onBack, onVerified }: {
  email: string
  expiresAt: number
  onBack: () => void
  onVerified: (token: string) => Promise<void>
}) {
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [resendAt, setResendAt] = useState(() => Date.now() + resendCooldownMs)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'verify' | 'signup' | 'resend' | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const id = useId()
  const now = useNow()
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const expired = seconds === 0 && busy !== 'signup'
  const resendCoolingDown = now < resendAt
  useEffect(() => {
    mounted.current = true
    document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.focus()
    return () => { mounted.current = false }
  }, [])
  async function verify(value: string) {
    if (pending.current || value.length !== 6 || Date.now() >= expiresAt) return
    pending.current = true
    setBusy('verify'); setError(''); setNotice('')
    try {
      const result = await api.request<VerificationResponse>('/auth/email/verification/confirm', { method: 'POST', auth: false, body: { email, code: value } })
      if (!result.verificationToken) throw new Error('인증 응답을 확인하지 못했어요.')
      if (!mounted.current) return
      setBusy('signup')
      await onVerified(result.verificationToken)
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : '인증하지 못했어요.')
    }
    finally { pending.current = false; if (mounted.current) setBusy(null) }
  }
  async function resend() {
    if (pending.current || Date.now() < resendAt) return
    pending.current = true
    setBusy('resend'); setError(''); setNotice('')
    try {
      const result = await api.request<ExpiresResponse>('/auth/email/verification', { method: 'POST', auth: false, body: { email } })
      if (!result.expiresInSeconds) throw new Error('인증 유효 시간을 확인하지 못했어요.')
      const sentAt = Date.now()
      setExpiresAt(sentAt + result.expiresInSeconds * 1000)
      setResendAt(sentAt + resendCooldownMs)
      setCode(''); setNotice('인증번호를 다시 보냈어요.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '재전송하지 못했어요.') }
    finally { pending.current = false; setBusy(null) }
  }
  return <>
    <button type="button" disabled={!!busy} onClick={onBack} className="flex min-h-11 w-fit items-center gap-2 text-body-compact text-muted hover:text-text-accent">
      <Icon name="arrow" size={15} className="rotate-180" />
      가입 정보 수정
    </button>
    <h1 tabIndex={-1} className="mt-3 type-page-title">이메일 인증</h1>
    <p className="mt-3 text-body-compact text-muted">하단 이메일로 전송된 인증번호 6자리를 입력해 주세요</p>
    <div className="mt-2 flex justify-between gap-3"><span className="break-all">{email}</span><span aria-label={`남은 시간 ${seconds}초`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
    <form className="mt-6 space-y-4" aria-busy={!!busy} onSubmit={event => { event.preventDefault(); void verify(code) }}>
      <VerificationCodeInput value={code} onChange={value => {
        if (pending.current) return
        setCode(value); setError('')
      }} readOnly={!!busy} invalid={!!error || expired} describedBy={error ? `${id}-error` : undefined} />
      {expired && <FeedbackMessage tone="error">유효 시간이 지났어요. 인증번호를 다시 받아 주세요.</FeedbackMessage>}
      {error && <FeedbackMessage id={`${id}-error`} tone="error">{error}</FeedbackMessage>}
      {notice && <FeedbackMessage tone="info">{notice}</FeedbackMessage>}
      <Button type="submit" className="w-full" loading={busy === 'verify' || busy === 'signup'} disabled={!!busy || code.length !== 6 || seconds === 0}>인증하고 가입하기</Button>
      <button type="button" disabled={!!busy || resendCoolingDown} title={resendCoolingDown ? '인증번호를 받은 뒤 30초 후에 다시 받을 수 있어요.' : undefined} onClick={() => { void resend() }} className="min-h-11 w-full text-body-compact text-muted underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40">인증번호 다시 받기</button>
    </form>
  </>
}
