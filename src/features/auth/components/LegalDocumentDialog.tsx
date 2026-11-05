import { useMemo } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { useBackend } from '@/features/backend/backend-context'
import { parseLegalMarkdown } from '../legal-markdown'
import { hasLegalContent } from '../legal-content'
import { LegalDocumentContent } from './LegalDocumentContent'

export function LegalDocumentDialog({ document, onClose }: { document: LegalDocumentId | null; onClose: () => void }) {
  const { terms } = useBackend()
  const serverDocument = terms.find(term => term.code === (document === 'terms' ? 'SERVICE' : document === 'privacy' ? 'PRIVACY' : ''))
  const content = document ? legalDocuments[document] : null
  const raw = serverDocument?.content
  const fromServer = hasLegalContent(raw)
  const blocks = useMemo(() => fromServer ? parseLegalMarkdown(raw ?? '') : content?.blocks ?? [], [fromServer, raw, content])
  return <Dialog open={!!content} onClose={onClose} title={content?.title ?? ''} className="max-w-3xl">
    {!fromServer && content && <p className="mb-6 rounded-control bg-surface px-4 py-3 text-caption leading-5 text-muted">사전예약 랜딩페이지 기준 · 2026년 10월 10일 시행</p>}
    {content && <LegalDocumentContent blocks={blocks} title={content.title} />}
  </Dialog>
}
