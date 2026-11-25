import { saveKakaoLogin } from './auth-storage'

/**
 * Sends the browser to Kakao's authorize page (the welcome screen's 「카카오로 시작」 and the consent screen's
 * 「카카오로 다시 시작」). Returns an error message when it cannot start; on success the page is leaving.
 *
 * Terms are not checked here any more: an existing account just signs in, and a new one reads and agrees to them on the
 * consent screen (/login/kakao-terms), which refuses to continue without readable terms.
 */
export function startKakaoLogin(next: string): string | null {
  const key = import.meta.env.VITE_KAKAO_REST_API_KEY as string | undefined
  const redirect = import.meta.env.VITE_KAKAO_REDIRECT_URI as string | undefined
  if (!key || !redirect) return '카카오 로그인을 준비하고 있어요. 이메일로 로그인해 주세요.'
  try {
    if (new URL(redirect).origin !== window.location.origin)
      return '현재 접속 주소에서 카카오 로그인을 사용할 수 없어요. 로그인 페이지 주소를 확인해 주세요.'
  } catch {
    return '카카오 로그인 주소를 확인하지 못했어요. 이메일로 로그인해 주세요.'
  }
  const state = crypto.randomUUID()
  if (!saveKakaoLogin({ state, next, redirect }))
    return '브라우저 저장소를 사용할 수 없어 카카오 로그인을 시작하지 못했어요. 저장소를 허용하거나 이메일로 로그인해 주세요.'
  const query = new URLSearchParams({ client_id: key, redirect_uri: redirect, response_type: 'code', state })
  window.location.assign(`https://kauth.kakao.com/oauth/authorize?${query}`)
  return null
}
