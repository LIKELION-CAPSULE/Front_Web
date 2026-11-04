import { Button } from '@/shared/ui/Button'
import { TermsConsent } from './TermsConsent'
import type { LegalDocumentId } from '../data/legal-documents'
import { FormField } from '@/shared/ui/FormField'
import { useId, useState } from 'react'
import { validateEmailAuth, type AuthErrors, type AuthField } from '../email-validation'

export type EmailAuthMode = 'login' | 'signup'

export function EmailAuthForm({
  mode,
  onSubmit,
  onOpenDocument,
}: {
  mode: EmailAuthMode
  onSubmit: (email: string, nickname: string) => void
  onOpenDocument: (document: LegalDocumentId) => void
}) {
  const signup = mode === 'signup'
  const id = useId()
  const [errors, setErrors] = useState<AuthErrors>({})
  const errorId = (field: AuthField) => `${id}-${field}-error`
  function clearError(field: AuthField) {
    setErrors(previous => {
      const next = { ...previous }
      delete next[field]
      if (field === 'password') delete next.confirmPassword
      return next
    })
  }

  return (
    <form
      noValidate
      className="mt-6 space-y-5 [--form-input-border:var(--color-input-border)]"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const email = form.elements.namedItem('email') as HTMLInputElement
        const next = validateEmailAuth({
          email: String(data.get('email') ?? ''), password: String(data.get('password') ?? ''),
          confirmPassword: String(data.get('confirmPassword') ?? ''),
          nickname: String(data.get('nickname') ?? ''),
          agreeTerms: data.has('agreeTerms'), agreePrivacy: data.has('agreePrivacy'),
        }, signup, email.validity.valid)
        setErrors(next)
        const invalid = Object.keys(next)[0]
        if (invalid) {
          (form.elements.namedItem(invalid) as HTMLInputElement | null)?.focus()
          return
        }
        // Signup fields stay in the mounted form while verification is shown,
        // so going back preserves the draft. Credentials are never persisted or sent.
        const address = String(data.get('email') ?? '').trim()
        if (!signup) form.reset()
        onSubmit(address, String(data.get('nickname') ?? '').trim())
      }}
    >
      <FormField label="이메일" error={errors.email} errorId={errorId('email')}>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="hello@example.com"
          className="form-input"
          aria-invalid={!!errors.email || undefined}
          aria-describedby={errors.email ? errorId('email') : undefined}
          onInput={() => clearError('email')}
        />
      </FormField>
      <FormField label="비밀번호" error={errors.password} errorId={errorId('password')}>
        <input
          name="password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          required
          minLength={signup ? 8 : undefined}
          placeholder={signup ? '8자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'}
          onInput={() => clearError('password')}
          aria-invalid={!!errors.password || undefined}
          aria-describedby={errors.password ? errorId('password') : undefined}
          className="form-input"
        />
      </FormField>
      {signup && (
        <FormField label="비밀번호 확인" error={errors.confirmPassword} errorId={errorId('confirmPassword')}>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            onInput={() => clearError('confirmPassword')}
            aria-invalid={!!errors.confirmPassword || undefined}
            aria-describedby={errors.confirmPassword ? errorId('confirmPassword') : undefined}
            className="form-input"
          />
        </FormField>
      )}
      {signup && (
        <FormField label="닉네임" error={errors.nickname} errorId={errorId('nickname')}>
          <input
            name="nickname"
            autoComplete="nickname"
            required
            maxLength={20}
            placeholder="닉네임을 입력해 주세요"
            onInput={() => clearError('nickname')}
            aria-invalid={!!errors.nickname || undefined}
            aria-describedby={errors.nickname ? errorId('nickname') : undefined}
            className="form-input"
          />
        </FormField>
      )}
      {signup && <TermsConsent onOpenDocument={onOpenDocument} errors={errors} onChange={clearError} />}
      <Button type="submit" className="w-full">
        {signup ? '회원가입' : '로그인'}
      </Button>
    </form>
  )
}
