import { capsuleCardLayout as layout } from './capsule-card-layout.ts'

/** `top` is the card-space y of the first line. */
export type QuoteFit = { top: number; fontSize: number; lineHeight: number; lines: string[] }
/** Width of `text` at `fontSize` px in the story font. */
export type MeasureText = (text: string, fontSize: number) => number

const ELLIPSIS = '…'

/** Splits on spaces (Korean keep-all) and only breaks inside a word that is wider than the line by itself. */
function wrap(text: string, fontSize: number, width: number, measure: MeasureText) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (measure(next, fontSize) <= width) { line = next; continue }
    if (line) lines.push(line)
    line = ''
    for (const char of word) {
      if (line && measure(line + char, fontSize) > width) { lines.push(line); line = char }
      else line += char
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Fits the closing line inside the card's quote box, shared by the preview and the PNG export.
 * Steps the font down until every line fits; at the smallest size the last visible line ends with an ellipsis.
 */
export function fitCardQuote(text: string, measure: MeasureText, box: { width: number; height: number } = { width: layout.contentWidth, height: layout.quote.maxHeight }): QuoteFit {
  const placed = (fontSize: number, lineHeight: number, lines: string[]): QuoteFit => ({
    top: Math.min(layout.quote.preferredTop, layout.quote.top + box.height - lines.length * lineHeight), fontSize, lineHeight, lines,
  })
  let last: { fontSize: number; lineHeight: number; lines: string[] } | null = null
  for (const fontSize of layout.quote.fontSizes) {
    const lineHeight = Math.round(fontSize * layout.quote.lineHeightRatio)
    last = { fontSize, lineHeight, lines: wrap(text.trim(), fontSize, box.width, measure) }
    if (last.lines.length * lineHeight <= box.height) return placed(fontSize, lineHeight, last.lines)
  }
  const { fontSize, lineHeight, lines } = last!
  const visible = lines.slice(0, Math.max(1, Math.floor(box.height / lineHeight)))
  let end = visible[visible.length - 1]!
  while (end && measure(end + ELLIPSIS, fontSize) > box.width) end = end.slice(0, -1)
  visible[visible.length - 1] = end.trimEnd() + ELLIPSIS
  return placed(fontSize, lineHeight, visible)
}

/** Measures with a canvas so the preview wraps exactly like the PNG export. */
export function canvasMeasure(ctx: CanvasRenderingContext2D, family: string): MeasureText {
  return (text, fontSize) => {
    ctx.font = `${layout.quote.fontWeight} ${fontSize}px "${family}"`
    return ctx.measureText(text).width
  }
}
let previewContext: CanvasRenderingContext2D | null = null
export function previewMeasure(family: string): MeasureText {
  previewContext ??= document.createElement('canvas').getContext('2d')
  // Without canvas support, a rough per-character width keeps the quote inside the card.
  return previewContext ? canvasMeasure(previewContext, family) : (text, fontSize) => text.length * fontSize
}
