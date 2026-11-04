import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { AnimatedCheckbox } from '@/shared/ui/AnimatedCheckbox'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { useId } from 'react'
import type { AuthErrors, AuthField } from '../email-validation'

export function TermsConsent({
  onOpenDocument,
  errors = {},
  onChange,
}: {
  onOpenDocument: (document: LegalDocumentId) => void
  errors?: AuthErrors
  onChange?: (field: AuthField) => void
}) {
  const id = useId()
  return (
    <fieldset className="relative min-w-0 space-y-4 py-2">
      <legend className="sr-only">약관 동의</legend>
      <div aria-hidden="true" className="flex items-center gap-3 type-label text-subtle">
        <span className="h-px flex-1 bg-divider" />
        약관 동의
        <span className="h-px flex-1 bg-divider" />
      </div>
      {(['terms', 'privacy'] as const).map((document) => {
        const name = document === 'terms' ? 'agreeTerms' : 'agreePrivacy'
        const errorId = `${id}-${name}-error`
        return (
          <div key={document}>
            <div className="flex items-start justify-between gap-3">
              <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 type-body-compact text-muted">
                <AnimatedCheckbox
                  name={name}
                  required
                  aria-invalid={!!errors[name] || undefined}
                  aria-describedby={errors[name] ? errorId : undefined}
                  onChange={() => onChange?.(name)}
                />
                <span>
                  <span className="mr-1 text-text-accent">[필수]</span>{' '}
                  {legalDocuments[document].title} 동의
                </span>
              </label>
              <button
                type="button"
                aria-label={`${legalDocuments[document].title} 보기`}
                onClick={() => onOpenDocument(document)}
                className="min-h-11 shrink-0 px-2 text-caption leading-5 text-subtle underline underline-offset-4 hover:text-text-accent"
              >
                보기
              </button>
            </div>
            {errors[name] && <FeedbackMessage id={errorId} tone="error">{errors[name]}</FeedbackMessage>}
          </div>
        )
      })}
    </fieldset>
  )
}
