import { safeReturnPath } from '../../shared/lib/format.ts'

/**
 * Where to go after signing in (user decision 2026-11-26):
 * - Someone who just finished onboarding (email signup, a first Kakao sign-in, or an account that still needed it)
 *   starts on home — not on the screen they happened to be on before (an empty 「내 메이트」 is a poor first stop) —
 *   unless `next` is a link someone sent them (`isSharedLink`).
 * - Someone signing in again goes back to `next`, as before.
 * `next` passes `safeReturnPath` first either way (same-site paths only).
 */
export function postAuthDestination({ next, newAccount }: { next: string | null | undefined; newAccount: boolean }): string {
  const path = safeReturnPath(next ?? null, '/')
  if (!newAccount) return path
  return isSharedLink(path) ? path : '/'
}

/**
 * Screens other people send links to: a mate's page (`/mates/:mateId`, not one's own `/mates/me`) and the invitation
 * (`/invite`, `/credits/invite`). The app has no shared connection-record address (`/connections/:id` is one's own).
 */
export function isSharedLink(path: string): boolean {
  const pathname = path.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/'
  if (pathname === '/invite' || pathname === '/credits/invite') return true
  const mate = /^\/mates\/([^/]+)$/.exec(pathname)
  return Boolean(mate && mate[1] !== 'me')
}
