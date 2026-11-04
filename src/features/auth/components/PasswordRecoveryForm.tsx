import { useId, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'

export function PasswordRecoveryForm() {
  const id = useId()
  const [error, setError] = useState<string>()
  const [unavailable, setUnavailable] = useState(false)

  return (
    <>
      <p className="mt-3 text-body-compact text-muted">가입한 이메일 주소를 입력해 주세요.</p>
      <form
        noValidate
        className="mt-6 space-y-5 [--form-input-border:var(--color-input-border)]"
        onSubmit={(event) => {
          event.preventDefault()
          const email = event.currentTarget.elements.namedItem('email') as HTMLInputElement
          const message = !email.value.trim()
            ? '이메일을 입력해 주세요.'
            : !email.validity.valid ? '이메일 주소를 확인해 주세요.' : undefined
          setError(message)
          setUnavailable(false)
          if (message) {
            email.focus()
            return
          }
          // Connect the password-reset service here before showing a sent confirmation.
          // The demo must not claim to send mail or change stored credentials.
          setUnavailable(true)
        }}
      >
        <FormField label="이메일" error={error} errorId={`${id}-error`}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="hello@example.com"
            className="form-input"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onInput={() => {
              setError(undefined)
              setUnavailable(false)
            }}
          />
        </FormField>
        <Button type="submit" className="w-full">재설정 링크 받기</Button>
        {unavailable && (
          <FeedbackMessage tone="info">
            비밀번호 재설정 기능을 준비하고 있어요. 아직 메일은 발송되지 않아요.
          </FeedbackMessage>
        )}
      </form>
    </>
  )
}
