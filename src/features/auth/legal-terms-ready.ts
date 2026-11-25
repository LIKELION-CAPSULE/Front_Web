import type { TermVersion } from '../../shared/api/types.ts'
import { devLegalTermsReady } from './dev-legal-terms.ts'
import { hasRequiredLegalTerms } from './legal-content.ts'

/**
 * Whether signup / Kakao start may go on with these terms: the published bodies (legal-content.ts). On the local dev
 * server only, placeholder bodies pass too (dev-legal-terms.ts); `import.meta.env.DEV` is `false` in production
 * builds, so that branch and its module are removed there.
 */
export function legalTermsReady(terms: readonly TermVersion[]): boolean {
  if (hasRequiredLegalTerms(terms)) return true
  if (import.meta.env.DEV) return devLegalTermsReady(terms)
  return false
}
