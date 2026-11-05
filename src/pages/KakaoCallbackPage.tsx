import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import type { KakaoRequest, KakaoResponse } from '@/shared/api/types'
import { safeReturnPath } from '@/shared/lib/format'
import { kakaoErrorNotice } from '@/features/auth/auth-notices'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'

export default function KakaoCallbackPage() {
  const [params] = useSearchParams()
  const { authenticate } = useBackend()
  const navigate = useNavigate()
  const request = useRef<Promise<void> | null>(null)
  useEffect(() => {
    if (request.current) return
    request.current = (async () => {
      const saved = JSON.parse(sessionStorage.getItem('capsule-kakao') ?? 'null') as { state?: string; next?: string; redirect?: string } | null
      const code = params.get('code')
      if (params.has('error')) { navigate('/login?notice=kakao-cancelled', { replace: true }); return }
      if (!saved?.state || saved.state !== params.get('state') || !code || !saved.redirect) { navigate('/login?notice=kakao-invalid-request', { replace: true }); return }
      const body: KakaoRequest = { code, redirectUri: saved.redirect }
      const result = await api.request<KakaoResponse>('/auth/social/KAKAO', { method: 'POST', auth: false, body })
      const me = await authenticate(result)
      sessionStorage.removeItem('capsule-kakao')
      sessionStorage.setItem('capsule-login-provider', 'KAKAO')
      const next = safeReturnPath(saved.next ?? null, '/')
      navigate(me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : next, { replace: true })
    })().catch(reason => {
      sessionStorage.removeItem('capsule-kakao')
      navigate(`/login?notice=${kakaoErrorNotice(reason)}`, { replace: true })
    })
  }, [authenticate, navigate, params])
  return <PageSkeleton label="카카오 로그인을 처리하고 있어요." />
}
