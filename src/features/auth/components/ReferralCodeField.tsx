import { useId } from 'react'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { REFERRAL_CODE_MAX_LENGTH } from '../referral-code'

export interface ReferralFieldValidationState {
  status: 'idle' | 'checking' | 'valid' | 'invalid'
  message?: string
  inviterNickname?: string
}

interface ReferralCodeFieldProps {
  value: string
  onChange: (value: string) => void
  onBlurValidate?: () => void
  validation: ReferralFieldValidationState
  fromInviteLink?: boolean
  inviterNickname?: string
  label?: string
  placeholder?: string
  showHelp?: boolean
  disabled?: boolean
  readOnly?: boolean
  inputRef?: React.Ref<HTMLInputElement>
}

export function ReferralCodeField({
  value,
  onChange,
  onBlurValidate,
  validation,
  fromInviteLink = false,
  inviterNickname,
  label = '초대 코드 (선택)',
  placeholder = '친구에게 받은 코드를 입력해 주세요',
  showHelp = true,
  disabled = false,
  readOnly = false,
  inputRef,
}: ReferralCodeFieldProps) {
  const fieldId = useId()
  const inputId = `${fieldId}-input`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  const isInvalid = validation.status === 'invalid' && Boolean(validation.message)
  const isValid = validation.status === 'valid'
  const effectiveInviter = validation.inviterNickname ?? inviterNickname
  const showInviteChip = fromInviteLink && value.trim().length > 0

  const describedBy = [isInvalid ? errorId : null, showHelp ? helpId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-1.5">
      <div className="referral-field-layout" data-has-chip={showInviteChip || undefined}>
        <label htmlFor={inputId} className="field-label referral-field-label">
          {label}
        </label>
        {showInviteChip && (
          <div className="referral-field-chip inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary-soft/65 px-2.5 py-0.5 text-caption font-medium text-text-accent">
            <Icon name="check" size={12} />
            <span>
              {effectiveInviter ? `${effectiveInviter}님의 초대로 왔어요` : '초대 코드가 적용됐어요'}
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          id={inputId}
          name="referralCode"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={REFERRAL_CODE_MAX_LENGTH}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          className="form-input referral-field-input uppercase"
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            const next = e.target.value.toUpperCase().slice(0, REFERRAL_CODE_MAX_LENGTH)
            onChange(next)
          }}
          onBlur={() => {
            const trimmed = value.trim().toUpperCase().slice(0, REFERRAL_CODE_MAX_LENGTH)
            if (trimmed !== value) onChange(trimmed)
            onBlurValidate?.()
          }}
        />
      </div>
      {isInvalid && (
        <FeedbackMessage id={errorId} tone="error">
          {validation.message}
        </FeedbackMessage>
      )}
      {isValid && (
        <p className="flex items-center gap-1.5 text-caption font-medium text-success" role="status">
          <Icon name="check" size={13} />
          <span>확인된 코드예요</span>
        </p>
      )}
      {showHelp && (
        <p id={helpId} className="text-caption text-muted">
          가입하고 첫 연결을 마치면 둘 다 크레딧 1,000을 받아요
        </p>
      )}
    </div>
  )
}
