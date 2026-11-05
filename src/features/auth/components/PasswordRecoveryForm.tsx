import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'
import { api, ApiError } from '@/shared/api/client'

export function PasswordRecoveryForm({ token, onReset }: { token?: string; onReset?: () => void } = {}) {
  const id = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)
  return <form className="mt-6 space-y-5" onSubmit={async event => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (token && (password.length < 8 || new TextEncoder().encode(password).length > 72)) { setError('비밀번호는 8자 이상, 72바이트 이하로 입력해 주세요.'); return }
    if (token && password !== data.get('confirmPassword')) { setError('비밀번호가 일치하지 않아요.'); return }
    setBusy(true); setError('')
    try {
      await api.request(token ? '/auth/password/reset' : '/auth/password/reset-request', {
        method: 'POST', auth: false, body: token ? { token, newPassword: password } : { email: String(data.get('email')).trim() },
      })
      setDone(true)
      if (token) onReset?.()
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'RESET_TOKEN_INVALID') {
        setInvalidToken(true)
        setError('재설정 링크가 만료됐거나 이미 사용됐어요. 새 링크를 받아 주세요.')
      } else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    }
    finally { setBusy(false) }
  }}>
    {token ? <>
      <FormField label="새 비밀번호"><input className="form-input" name="password" type="password" minLength={8} autoComplete="new-password" required /></FormField>
      <FormField label="새 비밀번호 확인"><input className="form-input" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></FormField>
    </> : <FormField label="이메일"><input className="form-input" name="email" type="email" autoComplete="email" required placeholder="hello@example.com" aria-describedby={`${id}-notice`} /></FormField>}
    <Button type="submit" className="w-full" disabled={busy || done || invalidToken}>{busy ? '처리하고 있어요…' : token ? '비밀번호 변경하기' : '재설정 링크 받기'}</Button>
    {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
    {invalidToken && <Link to="/login?mode=forgot-password" className="inline-flex min-h-11 items-center text-text-accent underline">재설정 링크 다시 받기</Link>}
    {done && <FeedbackMessage id={`${id}-notice`} tone="success">{token ? '비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요.' : '가입된 이메일이면 재설정 메일이 가요. 30분 안에 링크를 눌러 주세요.'}</FeedbackMessage>}
    {!token && <p className="text-caption text-muted">카카오로 가입했다면 카카오로 로그인해 주세요.</p>}
  </form>
}
