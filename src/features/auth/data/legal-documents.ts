import privacy from './legal/privacy.md?raw'
import terms from './legal/terms.md?raw'
import { parseLegalMarkdown } from '../legal-markdown'

export type LegalDocumentId = 'terms' | 'privacy'

export const legalDocuments = {
  terms: { title: '이용약관', blocks: parseLegalMarkdown(terms) },
  privacy: { title: '개인정보 처리방침', blocks: parseLegalMarkdown(privacy) },
}
