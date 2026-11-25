import type { TermVersion } from '../../shared/api/types.ts'
import { hasLegalText, hasRequiredLegalTerms } from './legal-content.ts'

/**
 * Local dev server only (user decision 2026-11-26): while the server's terms are still 「(… 본문 준비 중)」, signup and
 * Kakao start may go on with them. Reached only from the `import.meta.env.DEV` branch of legal-terms-ready.ts, so
 * production builds drop this module (and its warning) altogether. An empty body or a wrong code / version id still
 * fails. Says so once in the console.
 */
let warned = false
export function devLegalTermsReady(terms: readonly TermVersion[], warn: (message: string) => void = console.warn): boolean {
  if (!hasRequiredLegalTerms(terms, hasLegalText)) return false
  if (!warned) {
    warned = true
    warn('[dev] 약관 본문이 준비 중이라 개발 서버에서만 검사를 건너뜁니다.')
  }
  return true
}
