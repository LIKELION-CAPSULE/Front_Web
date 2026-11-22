import type { TermVersion } from '../../shared/api/types.ts'

/** Empty bodies and draft placeholders cannot be displayed as published account terms. */
export function hasLegalContent(content: string | null | undefined): content is string {
  if (!content?.trim()) return false
  const text = content.replace(/[\s()[\]_*#.!…]/g, '')
  return !/^(?:(?:서비스)?이용약관|개인정보처리방침)?(?:본문|내용)?준비중(?:입니다|이에요)?$/.test(text)
}

/** The consent form presents these two documents. Never auto-agree to an undisplayed required document. */
export function hasRequiredLegalTerms(terms: readonly TermVersion[]) {
  const required = terms.filter(term => term.required)
  return required.length === 2 && ['SERVICE', 'PRIVACY'].every(code => required.some(term =>
    term.code === code && typeof term.termVersionId === 'number' && Number.isSafeInteger(term.termVersionId) && term.termVersionId > 0 && hasLegalContent(term.content)))
}
