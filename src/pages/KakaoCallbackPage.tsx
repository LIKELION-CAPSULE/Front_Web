import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import type { KakaoRequest, KakaoResponse } from '@/shared/api/types'
import { safeReturnPath } from '@/shared/lib/format'
import { kakaoErrorNotice } from '@/features/auth/auth-notices'
import { clearKakaoLogin, readKakaoLogin, rememberLoginProvider } from '@/features/auth/auth-storage'
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
      if (params.has('error')) { clearKakaoLogin(); navigate('/login?notice=kakao-cancelled', { replace: true }); return }
      if (!saved || saved.state !== params.get('state') || !code) { clearKakaoLogin(); navigate('/login?notice=kakao-invalid-request', { replace: true }); return }
      const body: KakaoRequest = { code, redirectUri: saved.redirect }
      const result = await api.request<KakaoResponse>('/auth/social/KAKAO', { method: 'POST', auth: false, body })
      const next = safeReturnPath(saved.next ?? null, '/')
      setDestination(next)
      const me = await authenticate(result)
      clearKakaoLogin()
      rememberLoginProvider('KAKAO')
      navigate(me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : next, { replace: true })
    })().catch(reason => {
      clearKakaoLogin()
      navigate(`/login?notice=${kakaoErrorNotice(reason)}`, { replace: true })
    })
  }, [authenticate, navigate, params])
  return <RouteLoading destination={destination} label="카카오 로그인을 처리하고 있어요." />
}
