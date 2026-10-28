import { Dialog } from '@/shared/ui/Dialog'
import { legalDocuments, type LegalDocumentId } from '../data/legal-documents'

function inlineText(text: string) {
  return text
    .split(/(\*\*.*?\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
    )
}

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
      {content && (
        <>
          <p className="mb-6 rounded-control border border-transparent bg-surface px-4 py-3 text-xs leading-5 text-muted">
            사전예약 랜딩페이지 기준 · 2026년 10월 10일 시행
          </p>
          <article
            aria-label={`${content.title} 전문`}
            className="space-y-5 text-sm leading-7 text-muted"
          >
            {content.blocks.map((block, index) => {
              if (block.type === 'heading')
                return (
                  <h3 key={index} className="pt-2 font-semibold text-ink">
                    {block.text}
                  </h3>
                )
              if (block.type === 'paragraph') return <p key={index}>{inlineText(block.text)}</p>
              if (block.type === 'list') {
                const List = block.ordered ? 'ol' : 'ul'
                return (
                  <List
                    key={index}
                    className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-5`}
                  >
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{inlineText(item)}</li>
                    ))}
                  </List>
                )
              }
              if (block.type === 'table')
                return (
                  <div key={index} className="overflow-x-auto rounded-control border border-transparent">
                    <table className="w-full min-w-[440px] text-left text-xs leading-6">
                      <thead className="bg-surface text-ink">
                        <tr>
                          {block.headers.map((header, cell) => (
                            <th key={cell} scope="col" className="px-4 py-3 font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-line">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-3 align-top">
                                {inlineText(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              return null
            })}
          </article>
        </>
      )}
    </Dialog>
  )
}
