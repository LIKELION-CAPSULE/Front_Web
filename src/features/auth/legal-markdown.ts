export type LegalBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: LegalBlock[][] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'rule' }

export type LegalInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: LegalInline[] }
  | { type: 'emphasis'; children: LegalInline[] }
  | { type: 'link'; text: string; href: string | null }
  | { type: 'break' }

const heading = /^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/
const list = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/
const rule = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const tableDivider = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))

/** A text-only Markdown subset for legal documents; HTML never becomes executable markup. */
export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: LegalBlock[] = []
  let index = 0
  const beginsBlock = (at: number) => heading.test(lines[at] ?? '') || list.test(lines[at] ?? '') || rule.test(lines[at] ?? '')
    || /^\s*(?:>|```)/.test(lines[at] ?? '') || (lines[at]?.includes('|') && tableDivider.test(lines[at + 1] ?? ''))
  while (index < lines.length) {
    const line = lines[index]!
    if (!line.trim()) { index++; continue }
    const title = line.match(heading)
    if (title) { blocks.push({ type: 'heading', level: title[1]!.length, text: title[2]! }); index++; continue }
    if (rule.test(line)) { blocks.push({ type: 'rule' }); index++; continue }
    if (/^\s*```/.test(line)) {
      const content: string[] = []
      index++
      while (index < lines.length && !/^\s*```/.test(lines[index]!)) content.push(lines[index++]!)
      if (index < lines.length) index++
      blocks.push({ type: 'code', text: content.join('\n') }); continue
    }
    if (/^\s*>/.test(line)) {
      const content: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index]!)) content.push(lines[index++]!.replace(/^\s*>\s?/, ''))
      blocks.push({ type: 'quote', text: content.join(' ') }); continue
    }
    if (line.includes('|') && tableDivider.test(lines[index + 1] ?? '')) {
      const headers = cells(line), rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index]!.trim() && lines[index]!.includes('|')) rows.push(cells(lines[index++]!))
      blocks.push({ type: 'table', headers, rows }); continue
    }
    const marker = line.match(list)
    if (marker) {
      const indent = marker[1]!.length, ordered = /^\d/.test(marker[2]!), items: LegalBlock[][] = []
      const start = ordered ? Number.parseInt(marker[2]!, 10) : 1
      while (index < lines.length) {
        const item = lines[index]!.match(list)
        if (!item || item[1]!.length !== indent || /^\d/.test(item[2]!) !== ordered) break
        const content = [item[3]!]
        const contentIndent = item[0].length - item[3]!.length
        index++
        while (index < lines.length) {
          const next = lines[index]!, nextItem = next.match(list)
          if (nextItem && nextItem[1]!.length <= indent) break
          if (!next.trim()) {
            let after = index + 1
            while (after < lines.length && !lines[after]!.trim()) after++
            const following = lines[after] ?? '', followingItem = following.match(list)
            if (followingItem?.[1]?.length === indent) { index = after; break }
            if (!following.trim() || (following.match(/^\s*/)?.[0].length ?? 0) <= indent) break
            content.push(''); index++; continue
          }
          const space = next.match(/^\s*/)?.[0].length ?? 0
          if (space > indent) { content.push(next.slice(Math.min(space, contentIndent))); index++; continue }
          if (beginsBlock(index)) break
          content.push(next.trim()); index++
        }
        items.push(parseLegalMarkdown(content.join('\n')))
      }
      blocks.push({ type: 'list', ordered, start, items }); continue
    }
    const content = [line.trim()]
    index++
    while (index < lines.length && lines[index]!.trim() && !beginsBlock(index)) content.push(lines[index++]!.trim())
    blocks.push({ type: 'paragraph', text: content.join(' ') })
  }
  return blocks
}

export function safeLegalHref(value: string): string | null {
  const trimmed = value.trim()
  if (!/^(?:https?:|mailto:|tel:)/i.test(trimmed)) return null
  try { return new URL(trimmed).href } catch { return null }
}

export function parseLegalInline(text: string): LegalInline[] {
  const parts: LegalInline[] = []
  const tokens = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|<br\s*\/?>/gi
  let start = 0
  for (const match of text.matchAll(tokens)) {
    if (match.index > start) parts.push({ type: 'text', text: text.slice(start, match.index) })
    if (match[1]) parts.push({ type: 'strong', children: parseLegalInline(match[1]) })
    else if (match[2]) parts.push({ type: 'emphasis', children: parseLegalInline(match[2]) })
    else if (match[3]) parts.push({ type: 'code', text: match[3] })
    else if (match[4]) parts.push({ type: 'link', text: match[4], href: safeLegalHref(match[5]!) })
    else parts.push({ type: 'break' })
    start = match.index + match[0].length
  }
  if (start < text.length) parts.push({ type: 'text', text: text.slice(start) })
  return parts
}
