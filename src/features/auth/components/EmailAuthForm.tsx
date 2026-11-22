import { Button } from '@/shared/ui/Button'
import { TermsConsent } from './TermsConsent'
import type { LegalDocumentId } from '../data/legal-documents'
import { FormField } from '@/shared/ui/FormField'
import { useEffect, useId, useRef, useState } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { useBackend } from '@/features/backend/backend-context'
import { validateEmailAuth, type AuthErrors, type AuthField } from '../email-validation'
import { birthDateErrorField } from '../birth-date'
import { BirthDateField } from './BirthDateField'
import { ReferralCodeField, type ReferralFieldValidationState } from './ReferralCodeField'
import {
  normalizeReferralCode,
  readStoredReferralCode,
  shouldApplyIncomingReferral,
  subscribeStoredReferralCode,
} from '../referral-code'
import { hasRequiredLegalTerms } from '../legal-content'
import { NICKNAME_MAX_INPUT_UNITS } from '@/shared/api/constraints'

export type EmailAuthMode = 'login' | 'signup'

export function EmailAuthForm({
  mode,
  onSubmit,
  onOpenDocument,
  onReferralValid,
}: {
  mode: EmailAuthMode
  onSubmit: (input: {
    email: string
    password: string
    nickname: string
    birthDate: string
    referralCode?: string
  }) => Promise<void>
  onOpenDocument: (document: LegalDocumentId) => void
  onReferralValid?: () => void
}) {
  const signup = mode === 'signup'
  const { terms, validateReferralCode } = useBackend()
  const termsReady = hasRequiredLegalTerms(terms)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()
  const [errors, setErrors] = useState<AuthErrors>({})
  const errorId = (field: AuthField) => `${id}-${field}-error`

  // Auto-fill referral code from 7-day ?ref= link storage (never writes user-typed codes to storage)
  const [storedRef, setStoredRef] = useState(() => (signup ? readStoredReferralCode() : null))
  const [referralCode, setReferralCode] = useState(() => storedRef?.code ?? '')
  const [referralValidation, setReferralValidation] = useState<ReferralFieldValidationState>({
    status: 'idle',
    ...(storedRef?.inviterNickname ? { inviterNickname: storedRef.inviterNickname } : {}),
  })
  const referralInputRef = useRef<HTMLInputElement>(null)
  const referralCodeRef = useRef(referralCode)
  const userEditedReferralRef = useRef(false)
  const lastValidatedRef = useRef<string>('')

  useEffect(() => {
    referralCodeRef.current = referralCode
  }, [referralCode])

  // If an in-app navigation captures a new ?ref= code after mount, apply only if user hasn't typed
  useEffect(() => {
    if (!signup) return
    return subscribeStoredReferralCode((incoming) => {
      setStoredRef(incoming)
      if (shouldApplyIncomingReferral(referralCodeRef.current, userEditedReferralRef.current)) {
        setReferralCode(incoming.code)
        lastValidatedRef.current = ''
      }
    })
  }, [signup])

  function clearError(field: AuthField) {
    setErrors((previous) => {
      const next = { ...previous }
      delete next[field]
      if (field === 'password') delete next.confirmPassword
      return next
    })
  }

  async function runReferralValidation(raw: string, forSubmit = false): Promise<boolean> {
    const code = normalizeReferralCode(raw)
    if (!code) {
      setReferralValidation({ status: 'idle' })
      lastValidatedRef.current = ''
      return true
    }
    if (!validateReferralCode) {
      return true
    }
    setReferralValidation((prev) => ({ ...prev, status: 'checking' }))
    try {
      const res = await validateReferralCode(code)
      lastValidatedRef.current = code
      if (res.valid) {
        setReferralValidation({
          status: 'valid',
          ...(res.inviterNickname ? { inviterNickname: res.inviterNickname } : {}),
        })
        onReferralValid?.()
        return true
      }
      setReferralValidation({
        status: 'invalid',
        message:
          res.reason === 'self' || res.reason === 'already_registered'
            ? res.message
            : '확인할 수 없는 코드예요. 지우거나 고쳐 주세요',
      })
      return false
    } catch {
      setReferralValidation({
        status: 'invalid',
        message: forSubmit
          ? '확인할 수 없는 코드예요. 지우거나 고쳐 주세요'
          : '초대 코드를 확인하지 못했어요.',
      })
      return false
    }
  }

  // Auto-validate pre-filled ?ref= code on mount (StrictMode safe: sets lastValidatedRef only if still mounted)
  useEffect(() => {
    if (!signup || !storedRef?.code || !validateReferralCode) return
    if (lastValidatedRef.current === storedRef.code) return
    let active = true
    void validateReferralCode(storedRef.code).then((res) => {
      if (!active) return
      lastValidatedRef.current = storedRef.code
      if (res.valid) {
        setReferralValidation({
          status: 'valid',
          ...(res.inviterNickname ? { inviterNickname: res.inviterNickname } : {}),
        })
        onReferralValid?.()
      } else {
        setReferralValidation({ status: 'invalid', message: res.message })
      }
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [signup, storedRef, validateReferralCode, onReferralValid])

  return (
    <form
      noValidate
      className="mt-6 space-y-5 [--form-input-border:var(--color-input-border)]"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy || (signup && !termsReady)) return
        const form = event.currentTarget
        const data = new FormData(form)
        const email = form.elements.namedItem('email') as HTMLInputElement
        const next = validateEmailAuth(
          {
            email: String(data.get('email') ?? ''),
            password: String(data.get('password') ?? ''),
            confirmPassword: String(data.get('confirmPassword') ?? ''),
            nickname: String(data.get('nickname') ?? ''),
            birthDate: String(data.get('birthDate') ?? ''),
            agreeTerms: data.has('agreeTerms'),
            agreePrivacy: data.has('agreePrivacy'),
          },
          signup,
          email.validity.valid,
        )
        setErrors(next)
        const invalid = Object.keys(next)[0]
        if (invalid) {
          const focusName =
            invalid === 'birthDate' ? birthDateErrorField(String(data.get('birthDate') ?? '')) : invalid
          ;(form.elements.namedItem(focusName) as HTMLInputElement | null)?.focus()
          return
        }

        const normalizedRef = signup ? normalizeReferralCode(referralCode) : ''
        if (signup && normalizedRef && validateReferralCode) {
          const ok = await runReferralValidation(normalizedRef, true)
          if (!ok) {
            referralInputRef.current?.focus()
            return
          }
        }

        const address = String(data.get('email') ?? '').trim()
        setBusy(true)
        setError('')
        try {
          await onSubmit({
            email: address,
            password: String(data.get('password') ?? ''),
            nickname: String(data.get('nickname') ?? '').trim(),
            birthDate: String(data.get('birthDate') ?? ''),
            ...(normalizedRef ? { referralCode: normalizedRef } : {}),
          })
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
        } finally {
          setBusy(false)
        }
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
            maxLength={NICKNAME_MAX_INPUT_UNITS}
            placeholder="닉네임을 입력해 주세요"
            onInput={() => clearError('nickname')}
            aria-invalid={!!errors.nickname || undefined}
            aria-describedby={errors.nickname ? errorId('nickname') : undefined}
            className="form-input"
          />
        </FormField>
      )}
      {signup && (
        <BirthDateField
          onChange={() => clearError('birthDate')}
          error={errors.birthDate}
          errorId={errorId('birthDate')}
          readOnly={busy}
        />
      )}
      {signup && (
        <ReferralCodeField
          inputRef={referralInputRef}
          value={referralCode}
          fromInviteLink={Boolean(storedRef && normalizeReferralCode(referralCode) === storedRef.code)}
          inviterNickname={storedRef?.inviterNickname}
          validation={referralValidation}
          readOnly={busy}
          onChange={(nextVal) => {
            userEditedReferralRef.current = true
            setReferralCode(nextVal)
            if (normalizeReferralCode(nextVal) !== lastValidatedRef.current) {
              setReferralValidation({ status: 'idle' })
            }
          }}
          onBlurValidate={() => {
            const norm = normalizeReferralCode(referralCode)
            if (!norm) {
              setReferralValidation({ status: 'idle' })
              return
            }
            if (norm !== lastValidatedRef.current) {
              void runReferralValidation(norm, false)
            }
          }}
        />
      )}
      {signup && <TermsConsent onOpenDocument={onOpenDocument} errors={errors} onChange={clearError} />}
      {signup && !termsReady && (
        <FeedbackMessage tone="error">
          약관을 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.
        </FeedbackMessage>
      )}
      {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
      <Button type="submit" loading={busy} disabled={signup && !termsReady} className="w-full">
        {signup ? '회원가입' : '로그인'}
      </Button>
    </form>
  )
}
