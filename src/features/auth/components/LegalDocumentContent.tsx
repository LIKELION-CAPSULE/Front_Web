import { parseLegalInline, type LegalBlock, type LegalInline } from '../legal-markdown'
import './legal-document.css'

function Inline({ parts }: { parts: LegalInline[] }) {
  return parts.map((part, index) => {
    if (part.type === 'text') return <span key={index}>{part.text}</span>
    if (part.type === 'strong') return <strong key={index}><Inline parts={part.children} /></strong>
    if (part.type === 'emphasis') return <em key={index}><Inline parts={part.children} /></em>
    if (part.type === 'code') return <code key={index}>{part.text}</code>
    if (part.type === 'break') return <br key={index} />
    return part.href ? <a key={index} href={part.href} target={/^https?:/.test(part.href) ? '_blank' : undefined} rel="noopener noreferrer">{part.text}</a> : <span key={index}>{part.text}</span>
  })
}

function Blocks({ blocks, headingBase }: { blocks: LegalBlock[]; headingBase: number }) {
  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      const Heading = `h${Math.max(3, Math.min(6, block.level - headingBase + 3))}` as 'h3' | 'h4' | 'h5' | 'h6'
      return <Heading key={index}><Inline parts={parseLegalInline(block.text)} /></Heading>
    }
    if (block.type === 'paragraph') return <p key={index}><Inline parts={parseLegalInline(block.text)} /></p>
    if (block.type === 'quote') return <blockquote key={index}><Inline parts={parseLegalInline(block.text)} /></blockquote>
    if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>
    if (block.type === 'rule') return <hr key={index} />
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return <List key={index} start={block.ordered ? block.start : undefined}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Blocks blocks={item} headingBase={headingBase} /></li>)}</List>
    }
    return <div className="legal-table-scroll" tabIndex={0} role="region" aria-label={`${block.headers.map(header => header.replace(/\*/g, '')).join(' · ')} 표`} key={index}>
      <table><thead><tr>{block.headers.map((header, column) => <th key={column} scope="col"><Inline parts={parseLegalInline(header)} /></th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.headers.map((_, column) => <td key={column}><Inline parts={parseLegalInline(row[column] ?? '')} /></td>)}</tr>)}</tbody></table>
    </div>
  })
}

export function LegalDocumentContent({ blocks, title }: { blocks: LegalBlock[]; title: string }) {
  const levels = blocks.flatMap(block => block.type === 'heading' ? [block.level] : [])
  return <article className="legal-document" aria-label={`${title} 전문`}><Blocks blocks={blocks} headingBase={levels.length ? Math.min(...levels) : 1} /></article>
}
