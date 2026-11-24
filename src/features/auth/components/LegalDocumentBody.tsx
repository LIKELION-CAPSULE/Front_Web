import { useMemo } from 'react'
import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { useBackend } from '@/features/backend/backend-context'
import { parseLegalMarkdown } from '../legal-markdown'
import { hasLegalContent } from '../legal-content'
import { LegalDocumentContent } from './LegalDocumentContent'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'

/**
 * Shared legal document body shown inside the login screen's legal Dialog (LoginVariantLayout) and the mobile
 * notice's legal Dialog (MobileAccessGate).
 * Always resolves content strictly from server terms and never falls back to landing-page copy.
 */
export function LegalDocumentBody({ document }: { document: LegalDocumentId }) {
  const { terms } = useBackend()
  const serverDocument = terms.find(
    (term) => term.code === (document === 'terms' ? 'SERVICE' : 'PRIVACY'),
  )
  const content = legalDocuments[document]
  const raw = serverDocument?.content
  const fromServer = hasLegalContent(raw)
  const blocks = useMemo(() => (fromServer ? parseLegalMarkdown(raw ?? '') : []), [fromServer, raw])

  if (!fromServer) {
    return (
      <FeedbackMessage tone="error">
        약관을 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.
      </FeedbackMessage>
    )
  }

  return <LegalDocumentContent blocks={blocks} title={content.title} />
}
