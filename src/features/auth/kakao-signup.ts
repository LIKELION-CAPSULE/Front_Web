import type { TermVersion } from '../../shared/api/types.ts'
import type { LegalDocumentId } from './data/legal-documents.ts'
import type { KakaoSignupTicket } from './kakao-signup-contract.ts'

/** The consent screen, inside the login layout (채린's stage stays on the left). */
export const KAKAO_TERMS_PATH = '/login/kakao-terms'

/** Paths drawn by the login layout (LoginVariantLayout): the welcome / email screens and the Kakao consent panel. */
export function isLoginLayoutPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/login' || path === KAKAO_TERMS_PATH
}

// ── The sign-up ticket between the callback and the consent screen ──

type TicketStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type StorageAccess = () => TicketStorage
const tabStorage: StorageAccess = () => sessionStorage
const KEY = 'capsule-kakao-signup'

/** `next`: where the person was headed before Kakao (already through `safeReturnPath` when used). */
export type KakaoSignupSession = KakaoSignupTicket & { next: string }

/**
 * Session storage only (never the URL or localStorage): it survives a refresh of the consent screen and goes away with
 * the tab. Returns whether it was really written; the caller does not continue without it.
 */
export function saveKakaoSignup(value: KakaoSignupSession, storage: StorageAccess = tabStorage): boolean {
  try {
    const encoded = JSON.stringify({ signupToken: value.signupToken, expiresAt: value.expiresAt, next: value.next })
    const target = storage()
    target.setItem(KEY, encoded)
    return target.getItem(KEY) === encoded
  } catch { return false }
}

export type KakaoSignupLookup =
  | { status: 'none' }
  | { status: 'expired'; next: string }
  | { status: 'active'; session: KakaoSignupSession }

/** `none`: nothing saved (or unreadable) — the screen was opened directly. `expired`: saved, but its time has passed. */
export function readKakaoSignup(now: number, storage: StorageAccess = tabStorage): KakaoSignupLookup {
  let value: unknown
  try { value = JSON.parse(storage().getItem(KEY) ?? 'null') } catch { return { status: 'none' } }
  if (!value || typeof value !== 'object') return { status: 'none' }
  const { signupToken, expiresAt, next } = value as Record<string, unknown>
  if (typeof signupToken !== 'string' || !signupToken || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return { status: 'none' }
  const path = typeof next === 'string' && next ? next : '/'
  if (now >= expiresAt) return { status: 'expired', next: path }
  return { status: 'active', session: { signupToken, expiresAt, next: path } }
}

export function clearKakaoSignup(storage: StorageAccess = tabStorage) {
  try { storage().removeItem(KEY) } catch { /* Cleanup must not block the screen. */ }
}

// ── Consent ──

/** One required term on the consent screen: the legal modal document it opens and the server version id it sends. */
export type ConsentTerm = { document: LegalDocumentId; termVersionId: number; name: string }
export type ConsentChecks = Record<LegalDocumentId, boolean>

export const NO_CONSENT: ConsentChecks = { terms: false, privacy: false }

/** The two required documents in screen order (이용약관, then 개인정보 처리방침), from `GET /terms`. */
export function consentTerms(terms: readonly TermVersion[]): ConsentTerm[] {
  const pick = (document: LegalDocumentId, code: string, fallback: string): ConsentTerm[] => {
    const term = terms.find(value => value.required && value.code === code)
    const id = term?.termVersionId
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return []
    return [{ document, termVersionId: id, name: term?.name?.trim() || fallback }]
  }
  return [...pick('terms', 'SERVICE', '이용약관'), ...pick('privacy', 'PRIVACY', '개인정보 처리방침')]
}

/** 「전체 동의」: on only when every required term is checked; `mixed` when some are. */
export function allConsentState(checks: ConsentChecks, terms: readonly ConsentTerm[]): boolean | 'mixed' {
  const count = terms.filter(term => checks[term.document]).length
  if (terms.length > 0 && count === terms.length) return true
  return count === 0 ? false : 'mixed'
}

/** 「전체 동의」 toggled: turns every required term on, or (when all were on) off. */
export function toggleAllConsent(checks: ConsentChecks, terms: readonly ConsentTerm[]): ConsentChecks {
  const next = allConsentState(checks, terms) !== true
  return { ...checks, ...Object.fromEntries(terms.map(term => [term.document, next])) }
}

/** 「동의하고 시작하기」 is enabled only with readable terms, both required terms checked, and nothing in flight. */
export function canSubmitConsent(input: { checks: ConsentChecks; terms: readonly ConsentTerm[]; termsReady: boolean; busy: boolean }): boolean {
  return input.termsReady && !input.busy && input.terms.length === 2 && input.terms.every(term => input.checks[term.document])
}

/** The version ids the person actually checked, in screen order. */
export function agreedTermVersionIds(checks: ConsentChecks, terms: readonly ConsentTerm[]): number[] {
  return terms.filter(term => checks[term.document]).map(term => term.termVersionId)
}
