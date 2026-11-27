/**
 * The call stage's dialogue box (C1 「대사창」, call UI step 2, 2026-11-27): which line it shows, how a long line is
 * cut into pages and how fast and how long each page stays. Pure: CallDialogueBox and the review draft use it.
 */

/** A line for the box: `key` changes for a new line; `text` may grow while a reply streams in. */
export type StageLine = { key: string; text: string; at: number }

/**
 * The line the box shows: the newest of the candidates (her latest reply of this call, her latest event line), or none
 * once the newest one was closed (`doneKey`: it timed out, was turned past its last page, or the user sent a line).
 * An older candidate never comes back after a newer one closed.
 */
export function pickStageLine(candidates: readonly (StageLine | null | undefined)[], doneKey: string | null): StageLine | null {
  let newest: StageLine | null = null
  for (const line of candidates) if (line && line.text.trim() && (!newest || line.at >= newest.at)) newest = line
  return newest && newest.key !== doneKey ? newest : null
}

/** Splits a line into pages of about `max` letters at sentence ends, then at spaces (a page never splits a word). */
export function dialoguePages(text: string, max: number): string[] {
  const sentences = text.match(/[.!?…]*[^.!?…]+[.!?…]*\s*/g)?.map(part => part.trim()).filter(Boolean) ?? [text]
  const pages: string[] = []
  let current = ''
  const push = (part: string) => {
    if (!current) current = part
    else if (Array.from(current).length + 1 + Array.from(part).length <= max) current = `${current} ${part}`
    else { pages.push(current); current = part }
  }
  for (const sentence of sentences) {
    if (Array.from(sentence).length <= max) { push(sentence); continue }
    for (const word of sentence.split(' ')) if (word) push(word)
  }
  if (current) pages.push(current)
  return pages.length ? pages : [text]
}

/** The chat's letter pace (TypingMessage): the box types at the same speed. */
export { letterPace } from '../session/speech-pace.ts'

/** Box text size, side padding and lines a page (call-dialogue.css; the narrow box is smaller). */
const WIDE = { font: 18, padding: 80, lines: 2.4 }
/** A narrow stage (≈ 900px window with the chat open) shows the mate smaller and lower: pages of about two lines keep
 *  the box under her mouth. */
const NARROW = { font: 17, padding: 66, lines: 1.9 }
const DIALOGUE_MAX_WIDTH = 760

/**
 * Letters per page for a box `width` px wide: letters per line (Korean ≈ one font size a letter) × lines a page (2–3
 * lines; about 2 on a narrow stage). At least 14.
 */
export function dialogueCapacity(width: number) {
  const size = width < 560 ? NARROW : WIDE
  const perLine = Math.floor((Math.min(DIALOGUE_MAX_WIDTH, width) - size.padding) / size.font)
  return Math.max(14, Math.floor(perLine * size.lines))
}

/** How long a typed page stays: long enough to read; the last page a little longer (at most 6 s). */
export function dialogueHold(letters: number, last: boolean) {
  return last ? Math.min(6000, 2400 + letters * 40) : 800 + letters * 32
}
