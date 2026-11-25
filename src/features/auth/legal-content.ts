import type { TermVersion } from '../../shared/api/types.ts'

/** Empty bodies and draft placeholders cannot be displayed as published account terms. */
export function hasLegalContent(content: string | null | undefined): content is string {
  if (!content?.trim()) return false
  const text = content.replace(/[\s()[\]_*#.!…]/g, '')
  return !/^(?:(?:서비스)?이용약관|개인정보처리방침)?(?:본문|내용)?준비중(?:입니다|이에요)?$/.test(text)
}

/** Any text at all — a draft placeholder too — but never an empty body. */
export function hasLegalText(content: string | null | undefined): content is string {
  return Boolean(content?.trim())
}

/**
 * The consent form presents these two documents. Never auto-agree to an undisplayed required document.
 * `acceptsContent` decides what counts as a body: published text by default (`hasLegalContent`). The local dev server
 * alone passes `hasLegalText` (legal-terms-ready.ts) while the server's bodies are still placeholders; codes and
 * version ids are checked the same either way.
 */
export function hasRequiredLegalTerms(
  terms: readonly TermVersion[],
  acceptsContent: (content: string | null | undefined) => boolean = hasLegalContent,
) {
  const required = terms.filter(term => term.required)
  return required.length === 2 && ['SERVICE', 'PRIVACY'].every(code => required.some(term =>
    term.code === code && typeof term.termVersionId === 'number' && Number.isSafeInteger(term.termVersionId) && term.termVersionId > 0 && acceptsContent(term.content)))
}
