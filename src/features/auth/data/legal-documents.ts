import privacy from './legal/privacy.md?raw'
import terms from './legal/terms.md?raw'

export type LegalDocumentId = 'terms' | 'privacy'

type LegalBlock =
  | { type: 'heading' | 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }

// The landing documents contain only headings, paragraphs, lists and tables.
// Render them as React text; raw HTML is never inserted into the page.
function parseDocument(markdown: string): LegalBlock[] {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .map((section) => {
      const lines = section.split('\n')
      if (section.startsWith('### ')) return { type: 'heading', text: section.slice(4) }
      if (section.startsWith('|')) {
        const cells = (line: string) =>
          line
            .trim()
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim())
        return { type: 'table', headers: cells(lines[0] ?? ''), rows: lines.slice(2).map(cells) }
      }
      if (/^\d+\. /.test(section) || section.startsWith('- ')) {
        return {
          type: 'list',
          ordered: /^\d+\. /.test(section),
          items: lines.map((line) => line.replace(/^(\d+\.|-) /, '')),
        }
      }
      return { type: 'paragraph', text: lines.join(' ') }
    })
}

export const legalDocuments = {
  terms: { title: '이용약관', blocks: parseDocument(terms) },
  privacy: { title: '개인정보 처리방침', blocks: parseDocument(privacy) },
}
