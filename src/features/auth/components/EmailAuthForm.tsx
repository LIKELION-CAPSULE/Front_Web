import { Button } from '@/shared/ui/Button'
import { TermsConsent } from './TermsConsent'
import type { LegalDocumentId } from '../data/legal-documents'

export type EmailAuthMode = 'login' | 'signup'

export function EmailAuthForm({
  mode,
  onSubmit,
  onOpenDocument,
}: {
  mode: EmailAuthMode
  onSubmit: () => void
  onOpenDocument: (document: LegalDocumentId) => void
}) {
  const signup = mode === 'signup'

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (signup) {
          const values = new FormData(form)
          const confirmation = form.elements.namedItem('confirmPassword') as HTMLInputElement
          if (values.get('password') !== values.get('confirmPassword')) {
            confirmation.setCustomValidity('비밀번호가 일치하지 않아요.')
            confirmation.reportValidity()
            return
          }
        }
        // The demo never stores or sends email addresses and passwords.
        form.reset()
        onSubmit()
      }}
    >
      <label className="block text-sm text-muted">
        이메일
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="hello@example.com"
          className="form-input mt-2"
        />
      </label>
      <label className="block text-sm text-muted">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          required
          minLength={signup ? 8 : undefined}
          placeholder={signup ? '8자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'}
          onInput={(event) => {
            const confirmation = event.currentTarget.form?.elements.namedItem('confirmPassword')
            if (confirmation instanceof HTMLInputElement) confirmation.setCustomValidity('')
          }}
          className="form-input mt-2"
        />
      </label>
      {signup && (
        <label className="block text-sm text-muted">
          비밀번호 확인
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            onInput={(event) => event.currentTarget.setCustomValidity('')}
            className="form-input mt-2"
          />
        </label>
      )}
      {signup && <TermsConsent onOpenDocument={onOpenDocument} />}
      <Button type="submit" className="w-full">
        {signup ? '회원가입' : '로그인'}
      </Button>
    </form>
  )
}
