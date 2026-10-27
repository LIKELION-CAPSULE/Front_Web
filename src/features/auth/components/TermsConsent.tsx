import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { AnimatedCheckbox } from '@/shared/ui/AnimatedCheckbox'

export function TermsConsent({
  onOpenDocument,
}: {
  onOpenDocument: (document: LegalDocumentId) => void
}) {
  return (
    <fieldset className="relative min-w-0 space-y-4 py-2">
      <legend className="sr-only">약관 동의</legend>
      <div aria-hidden="true" className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" />
        약관 동의
        <span className="h-px flex-1 bg-line" />
      </div>
      {(['terms', 'privacy'] as const).map((document) => (
        <div key={document} className="flex items-start justify-between gap-3">
          <label className="flex min-w-0 cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted">
            <AnimatedCheckbox
              name={document === 'terms' ? 'agreeTerms' : 'agreePrivacy'}
              required
              className="mt-0.5"
            />
            <span>
              <span className="mr-1 text-brand-strong">[필수]</span>{' '}
              {legalDocuments[document].title} 동의
            </span>
          </label>
          <button
            type="button"
            aria-label={`${legalDocuments[document].title} 보기`}
            onClick={() => onOpenDocument(document)}
            className="shrink-0 text-xs leading-5 text-subtle underline underline-offset-4 hover:text-brand-strong"
          >
            보기
          </button>
        </div>
      ))}
    </fieldset>
  )
}
