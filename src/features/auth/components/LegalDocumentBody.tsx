import { useEffect, useMemo, useState } from 'react'
import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import type { TermsResponse, TermVersion } from '@/shared/api/types'
import { parseLegalMarkdown } from '../legal-markdown'
import { hasLegalContent } from '../legal-content'
import { LegalDocumentContent } from './LegalDocumentContent'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'

/**
 * The server terms for this body. The backend loads them on the login screen only; opened anywhere else (the site
 * footer, the mobile notice) the body asks `GET /terms` itself, once, the same public call (no sign-in needed).
 */
function useServerTerms(): { terms: readonly TermVersion[]; loading: boolean } {
  const { terms: loaded } = useBackend()
  const [fetched, setFetched] = useState<{ terms: readonly TermVersion[] } | null>(null)
  const needed = loaded.length === 0
  useEffect(() => {
    if (!needed) return
    let alive = true
    void api
      .request<TermsResponse>('/terms', { auth: false })
      .then((value) => { if (alive) setFetched({ terms: Array.isArray(value.terms) ? value.terms : [] }) })
      .catch(() => { if (alive) setFetched({ terms: [] }) })
    return () => { alive = false }
  }, [needed])
  if (!needed) return { terms: loaded, loading: false }
  return { terms: fetched?.terms ?? [], loading: fetched === null }
}

/**
 * Shared legal document body shown inside the login screen's legal Dialog (LoginVariantLayout), the mobile notice's
 * legal Dialog (MobileAccessGate) and the site footer's (SiteFooter).
 * Always resolves content strictly from server terms and never falls back to landing-page copy.
 */
export function LegalDocumentBody({ document }: { document: LegalDocumentId }) {
  const { terms, loading } = useServerTerms()
  const serverDocument = terms.find(
    (term) => term.code === (document === 'terms' ? 'SERVICE' : 'PRIVACY'),
  )
  const content = legalDocuments[document]
  const raw = serverDocument?.content
  const fromServer = hasLegalContent(raw)
  const blocks = useMemo(() => (fromServer ? parseLegalMarkdown(raw ?? '') : []), [fromServer, raw])

  if (!fromServer && loading) {
    return (
      <div className="flex items-center gap-3 text-muted" role="status">
        <QuarterRingSpinner />
        <span>약관을 불러오고 있어요.</span>
      </div>
    )
  }

  if (!fromServer) {
    return (
      <FeedbackMessage tone="error">
        약관을 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.
      </FeedbackMessage>
    )
  }

  return <LegalDocumentContent blocks={blocks} title={content.title} />
}
