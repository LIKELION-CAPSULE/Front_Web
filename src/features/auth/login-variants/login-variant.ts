/**
 * Login screen concepts for PM comparison.
 * - desktop: the shipped "laptop desktop" login (default)
 * - illustration: full-bleed illustration with the form on the right
 * - portrait: the mate's face fills the screen (Live2D close-up)
 *
 * Selected with `?login=<variant>` and remembered for the tab (sessionStorage) so that
 * moving between 시작하기 / 로그인 / 회원가입 keeps the same concept. `?login=desktop` clears it.
 */
export const LOGIN_VARIANTS = ['desktop', 'illustration', 'portrait'] as const
export type LoginVariant = (typeof LOGIN_VARIANTS)[number]

export const LOGIN_VARIANT_LABELS: Record<LoginVariant, string> = {
  desktop: '바탕화면',
  illustration: '일러스트',
  portrait: '얼굴 크게',
}

export const LOGIN_VARIANT_PARAM = 'login'
export const LOGIN_VARIANT_STORAGE_KEY = 'capsule-login-variant:v1'

export function parseLoginVariant(value: string | null | undefined): LoginVariant | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return (LOGIN_VARIANTS as readonly string[]).includes(normalized) ? (normalized as LoginVariant) : null
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Resolves the variant from the query first, then the remembered value.
 * Writes the query value to storage (or clears it for `desktop`) so later in-app navigations keep it.
 */
export function resolveLoginVariant(search: string, storage: StorageLike | null): LoginVariant {
  const fromQuery = parseLoginVariant(new URLSearchParams(search).get(LOGIN_VARIANT_PARAM))
  if (fromQuery) {
    try {
      if (fromQuery === 'desktop') storage?.removeItem(LOGIN_VARIANT_STORAGE_KEY)
      else storage?.setItem(LOGIN_VARIANT_STORAGE_KEY, fromQuery)
    } catch {
      // Storage blocked: the query still applies for this render.
    }
    return fromQuery
  }
  try {
    return parseLoginVariant(storage?.getItem(LOGIN_VARIANT_STORAGE_KEY)) ?? 'desktop'
  } catch {
    return 'desktop'
  }
}

/** True when the user has explicitly picked a concept (shows the comparison switcher). */
export function hasExplicitLoginVariant(search: string, storage: StorageLike | null): boolean {
  if (parseLoginVariant(new URLSearchParams(search).get(LOGIN_VARIANT_PARAM))) return true
  try {
    return parseLoginVariant(storage?.getItem(LOGIN_VARIANT_STORAGE_KEY)) !== null
  } catch {
    return false
  }
}

/** Only the entry screen (/login) switches concepts; onboarding and password reset keep the desktop shell. */
export function isLoginVariantPath(pathname: string): boolean {
  return (pathname.replace(/\/+$/, '') || '/') === '/login'
}
