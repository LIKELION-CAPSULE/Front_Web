import { useEffect, useId, useRef, useState } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { VerificationCodeInput } from '@/shared/ui/VerificationCodeInput'
import { useNow } from '@/features/session/use-now'
import { createEmailVerificationPreview, emailVerificationPreviewError, PREVIEW_EMAIL_CODE } from '../email-verification-preview'

/** Frontend preview. Replace the preview challenge/verification with the real auth service when available. */
export function EmailVerificationForm({ email, onBack, onVerified }: {
  email: string
  onBack: () => void
  onVerified: () => void
}) {
  const [challenge, setChallenge] = useState(() => createEmailVerificationPreview(email, Date.now()))
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'verified'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const field = useRef<HTMLDivElement>(null)
  const id = useId()
  const now = useNow()
  const seconds = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
  const resendSeconds = Math.max(0, Math.ceil((challenge.resendAt - now) / 1000))
  const expired = seconds === 0 && status !== 'verified'
  const message = expired ? '인증번호의 유효 시간이 지났어요. 새 번호를 받아 주세요.' : error

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (status === 'verified') field.current?.closest('form')?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus({ preventScroll: true })
  }, [status])

  function verify(value: string) {
    if (status === 'checking' || status === 'verified') return
    setStatus('checking')
    setError(null)
    timer.current = setTimeout(() => {
      timer.current = null
      const next = emailVerificationPreviewError(value, challenge.expiresAt, Date.now())
      setError(next)
      setStatus(next ? 'error' : 'verified')
      if (next) field.current?.querySelector('input')?.select()
    }, 500)
  }

  function resend() {
    if (Date.now() < challenge.resendAt || status === 'checking') return
    setChallenge(createEmailVerificationPreview(email, Date.now()))
    setCode('')
    setError(null)
    setStatus('idle')
    setResent(true)
    field.current?.querySelector('input')?.focus({ preventScroll: true })
  }

  return (
    <>
      <button type="button" onClick={onBack} className="mt-4 flex min-h-11 w-fit items-center gap-2 text-body-compact text-muted hover:text-text-accent">
        <Icon name="arrow" size={15} className="rotate-180" /> 가입 정보 수정
      </button>
      <h1 tabIndex={-1} className="mt-3 type-page-title focus:outline-none">이메일 인증</h1>
      <p className="mt-3 text-body-compact text-muted">하단의 이메일로 전송된 6자리를 입력해주세요</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 break-all text-body font-semibold text-ink">{email}</p>
        <span
          aria-label={`유효 시간 ${Math.floor(seconds / 60)}분 ${seconds % 60}초`}
          aria-hidden={status === 'verified' || undefined}
          className={`w-12 shrink-0 text-right text-label tabular-nums text-subtle${status === 'verified' ? ' invisible' : ''}`}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>

      <form className="mt-6" noValidate onSubmit={(event) => {
        event.preventDefault()
        if (status === 'verified') onVerified()
      }}>
        <div ref={field} aria-busy={status === 'checking'}>
          <VerificationCodeInput
            value={code}
            onChange={(value) => {
              setCode(value)
              setError(null)
              setStatus('idle')
              setResent(false)
              if (value.length === 6) verify(value)
            }}
            readOnly={status === 'checking'}
            verified={status === 'verified'}
            successLabel="이메일 인증을 완료했어요"
            invalid={!!message}
            describedBy={message ? `${id}-error ${id}-preview` : `${id}-preview`}
          />
        </div>
        {message && <FeedbackMessage id={`${id}-error`} tone="error" className="mt-2">{message}</FeedbackMessage>}
        <div className="mt-2 flex min-h-11 items-center justify-center text-body-compact">
          {status === 'verified' ? <button type="submit" className="min-h-11 min-w-11 text-text-accent underline underline-offset-4 hover:text-text-accent-hover">로그인</button> : <button type="button" disabled={resendSeconds > 0 || status === 'checking'} onClick={resend} className="min-h-11 text-text-accent underline underline-offset-4 disabled:cursor-not-allowed disabled:text-text-disabled">
            {resendSeconds > 0 ? `${resendSeconds}초 후 다시 받기` : '인증번호 다시 받기'}
          </button>}
        </div>
        {resent && status !== 'verified' && <FeedbackMessage tone="info" className="mt-2">새 인증번호를 준비했어요.</FeedbackMessage>}
        <p id={`${id}-preview`} className="mt-1 text-center text-caption text-subtle">
          화면 확인용 인증번호는 <strong className="font-semibold tabular-nums text-muted">{PREVIEW_EMAIL_CODE}</strong>이에요.
        </p>
      </form>
    </>
  )
}
