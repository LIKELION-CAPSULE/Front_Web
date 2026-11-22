import { Dialog } from '@/shared/ui/Dialog'
import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'
import { LegalDocumentBody } from './LegalDocumentBody'

export function LegalDocumentDialog({
  document,
  onClose,
}: {
  document: LegalDocumentId | null
  onClose: () => void
}) {
  const content = document ? legalDocuments[document] : null
  return (
    <Dialog open={!!content} onClose={onClose} title={content?.title ?? ''} className="max-w-3xl">
      {document && <LegalDocumentBody document={document} />}
    </Dialog>
  )
}
