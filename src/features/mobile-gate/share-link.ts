/**
 * The mobile access screen's invite and link (MobileNoticeScreen). No imports, so tests/mobile-gate.test.ts runs it as is.
 * main.tsx `captureReferralFromLocation` has already stored the invite link's code (`/i/<code>` → `/invite`, `?ref=`);
 * the screen shows that code and hands the PC an address that still carries it.
 */

export type MobileInvite = { code: string; inviter: string | null }

/** The invite of this visit: `?ref=` / `?invite=` / `?inviter=` on the address, else the stored code (7 days). */
export function resolveMobileInvite(
  search: string,
  stored: { code: string; inviterNickname?: string } | null,
): MobileInvite | null {
  const params = new URLSearchParams(search)
  const rawCode = params.get('ref') || params.get('invite') || stored?.code || null
  const code = rawCode ? rawCode.trim().toUpperCase() : ''
  if (!code) return null
  const inviter = params.get('inviter')?.trim() || stored?.inviterNickname?.trim() || null
  return { code, inviter }
}

/** This page's address for the PC: the review marker removed, the invite code added when the address has none. */
export function buildMobileShareUrl(origin: string, pathname: string, search: string, hash: string, code: string | null): string {
  const url = new URL(pathname + search + hash, origin)
  url.searchParams.delete('__review')
  if (code && !url.searchParams.has('ref') && !url.searchParams.has('invite')) {
    url.searchParams.set('ref', code)
  }
  return url.toString()
}
