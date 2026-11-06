type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type StorageAccess = () => AuthStorage
const tabStorage: StorageAccess = () => sessionStorage

export type KakaoLoginState = { state: string; next: string; redirect: string }

/** OAuth state must survive the external redirect. Do not continue if it cannot be saved. */
export function saveKakaoLogin(value: KakaoLoginState, storage: StorageAccess = tabStorage) {
  try {
    const encoded = JSON.stringify(value)
    const target = storage()
    target.setItem('capsule-kakao', encoded)
    return target.getItem('capsule-kakao') === encoded
  } catch { return false }
}

export function readKakaoLogin(storage: StorageAccess = tabStorage): KakaoLoginState | null {
  try {
    const value: unknown = JSON.parse(storage().getItem('capsule-kakao') ?? 'null')
    if (!value || typeof value !== 'object' || !('state' in value) || !('next' in value) || !('redirect' in value)) return null
    return typeof value.state === 'string' && !!value.state && typeof value.next === 'string' && typeof value.redirect === 'string' && !!value.redirect
      ? { state: value.state, next: value.next, redirect: value.redirect } : null
  } catch { return null }
}

export function clearKakaoLogin(storage: StorageAccess = tabStorage) {
  try { storage().removeItem('capsule-kakao') } catch { /* Cleanup must not block authentication or its error screen. */ }
}

export function rememberLoginProvider(provider: 'EMAIL' | 'KAKAO', storage: StorageAccess = tabStorage) {
  try { storage().setItem('capsule-login-provider', provider) } catch { /* Optional metadata must not block a successful login. */ }
}
