import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import { deviceHash } from '@/shared/api/device-hash'
import type { KakaoRequest, KakaoResponse } from '@/shared/api/types'
import { postAuthDestination } from '@/features/auth/post-auth'
import { kakaoErrorNotice } from '@/features/auth/auth-notices'
import { clearKakaoLogin, readKakaoLogin, rememberLoginProvider } from '@/features/auth/auth-storage'
import { KAKAO_LOGIN_PATH, readKakaoSignupRequired } from '@/features/auth/kakao-signup-contract'
import { clearKakaoSignup, KAKAO_TERMS_PATH, saveKakaoSignup } from '@/features/auth/kakao-signup'
import { RouteLoading } from '@/app/components/RouteLoading'

export default function KakaoCallbackPage() {
  const [params] = useSearchParams()
  const { authenticate } = useBackend()
  const navigate = useNavigate()
  const request = useRef<Promise<void> | null>(null)
  const [destination, setDestination] = useState<string | null>(null)
  useEffect(() => {
    if (request.current) return
    request.current = (async () => {
      const saved = readKakaoLogin()
      const code = params.get('code')
      // A new Kakao attempt replaces any earlier, unfinished sign-up ticket in this tab.
      clearKakaoSignup()
      if (params.has('error')) { clearKakaoLogin(); navigate('/login?notice=kakao-cancelled', { replace: true }); return }
      if (!saved || saved.state !== params.get('state') || !code) { clearKakaoLogin(); navigate('/login?notice=kakao-invalid-request', { replace: true }); return }
      // 11-25: `deviceHash` is required for existing users too (400 without it).
      const body: KakaoRequest = { code, redirectUri: saved.redirect, deviceHash: await deviceHash() }
      // Signing in again: back to `next`; a new account goes through onboarding, which applies the new-account rule.
      const next = postAuthDestination({ next: saved.next, newAccount: false })
      let result: KakaoResponse
      try {
        result = await api.request<KakaoResponse>(KAKAO_LOGIN_PATH, { method: 'POST', auth: false, body })
      } catch (reason) {
        // A first-time Kakao user (contract a′): no account yet. Keep the sign-up ticket in this tab only and read the
        // terms on the consent screen; the URL never carries it.
        const ticket = readKakaoSignupRequired(reason, Date.now())
        if (!ticket) throw reason
        clearKakaoLogin()
        if (!saveKakaoSignup({ ...ticket, next })) { navigate('/login?notice=kakao-failed', { replace: true }); return }
        navigate(KAKAO_TERMS_PATH, { replace: true })
        return
      }
      setDestination(next)
      const me = await authenticate(result)
      clearKakaoLogin()
      rememberLoginProvider('KAKAO')
      navigate(me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : next, { replace: true })
    })().catch(reason => {
      clearKakaoLogin()
      // The beta is full (6 → 403 BETA_FULL for a new account): the launch notice sign-up.
      if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'BETA_FULL') navigate('/login?mode=waitlist', { replace: true })
      else navigate(`/login?notice=${kakaoErrorNotice(reason)}`, { replace: true })
    })
  }, [authenticate, navigate, params])
  return <RouteLoading destination={destination} label="카카오 로그인을 처리하고 있어요." />
}
