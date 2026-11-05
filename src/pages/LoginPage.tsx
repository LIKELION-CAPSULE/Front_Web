import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import type { ExpiresResponse, LoginResponse } from '@/shared/api/types'
import { authNotice } from '@/features/auth/auth-notices'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationContent, type NotificationItem } from '@/shared/ui/notification-queue'
import { PageNavigation } from '@/app/PageNavigation'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import { authPosters } from '@/features/auth/posters'
import { PosterMosaic } from '@/shared/ui/poster-mosaic/PosterMosaic'
import { EmailAuthForm, type EmailAuthMode } from '@/features/auth/components/EmailAuthForm'
import { EmailVerificationForm } from '@/features/auth/components/EmailVerificationForm'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'
import { LegalDocumentDialog } from '@/features/auth/components/LegalDocumentDialog'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'

export default function LoginPage() {
  const backend = useBackend()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  const [signupDraft, setSignupDraft] = useState<{ email: string; password: string; nickname: string; expiresAt: number } | null>(null)
  const scrollPane = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const mode = params.get('mode')
  const view = params.has('token') ? 'forgot-password' : mode === 'login' || mode === 'signup' || mode === 'forgot-password' ? mode : 'welcome'
  const verifying = view === 'signup' && signupDraft !== null
  const next = safeReturnPath(params.get('next'), '/')
  const noticeCode = params.get('notice')
  const showNotification = useCallback((content: NotificationContent) => {
    const item = { ...content, id: crypto.randomUUID() }
    setNotifications(current => enqueueNotification(current, item))
  }, [])
  const dismissNotification = useCallback((id: string) => setNotifications(current => current.filter(item => item.id !== id)), [])
  useEffect(() => {
    document.title = `CAPSULE · ${verifying ? '이메일 인증' : view === 'login' ? '로그인' : view === 'signup' ? '회원가입' : view === 'forgot-password' ? '비밀번호 찾기' : '같이 공부할 친구가 기다리고 있어요'}`
    scrollPane.current?.scrollTo({ top: 0 })
    panel.current?.querySelector<HTMLElement>(verifying ? 'input[autocomplete="one-time-code"]' : 'h1')?.focus({ preventScroll: true })
  }, [view, verifying])
  useEffect(() => {
    if (!noticeCode || params.has('token')) return
    const notice = authNotice(noticeCode)
    const search = new URLSearchParams(params)
    search.delete('notice')
    // Mount the destination first so its result can enter and be announced separately.
    const frame = requestAnimationFrame(() => {
      if (notice) showNotification(notice)
      navigate({ pathname: location.pathname, search: search.size ? `?${search}` : '', hash: location.hash }, { replace: true, state: location.state })
    })
    return () => cancelAnimationFrame(frame)
  }, [noticeCode, params, location.pathname, location.hash, location.state, navigate, showNotification])
  function authPath(target?: EmailAuthMode | 'forgot-password') {
    const search = new URLSearchParams(params)
    if (target !== 'forgot-password') search.delete('token')
    if (target) search.set('mode', target)
    else search.delete('mode')
    return `/login${search.size ? `?${search}` : ''}`
  }
  async function complete(result: LoginResponse) {
    const me = await backend.authenticate(result)
    setSignupDraft(null)
    sessionStorage.setItem('capsule-login-provider', 'EMAIL')
    navigate(me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : next, { replace: true })
  }
  function kakao() {
    const showError = (text: string) => showNotification({ tone: 'error', title: '카카오 로그인 오류', text })
    const key = import.meta.env.VITE_KAKAO_REST_API_KEY as string | undefined
    const redirect = import.meta.env.VITE_KAKAO_REDIRECT_URI as string | undefined
    if (!key || !redirect) { showError('카카오 로그인을 준비하고 있어요. 이메일로 로그인해 주세요.'); return }
    if (!['SERVICE', 'PRIVACY'].every(code => backend.terms.some(term => term.code === code && term.termVersionId && term.content))) {
      showError('약관 정보를 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.'); return
    }
    try {
      if (new URL(redirect).origin !== window.location.origin) { showError('현재 접속 주소에서 카카오 로그인을 사용할 수 없어요. 로그인 페이지 주소를 확인해 주세요.'); return }
    } catch { showError('카카오 로그인 주소를 확인하지 못했어요. 이메일로 로그인해 주세요.'); return }
    const state = crypto.randomUUID()
    sessionStorage.setItem('capsule-kakao', JSON.stringify({ state, next, redirect }))
    const query = new URLSearchParams({ client_id: key, redirect_uri: redirect, response_type: 'code', state })
    window.location.assign(`https://kauth.kakao.com/oauth/authorize?${query}`)
  }
  if (params.has('token')) return <Navigate to={`/password/reset?${params}`} replace />
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="login-page grid h-dvh min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden focus:outline-none"
    >
      <PageNavigation />
      <section
        aria-label="캡슐 공부 공간 소개"
        className="login-world min-h-0 min-w-0 overflow-hidden"
      >
        <div className="absolute inset-0">
          <PosterMosaic images={authPosters} />
        </div>
      </section>
      <section
        ref={scrollPane}
        aria-label="로그인 및 회원가입"
        className="login-scroll-pane flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-y-contain"
      >
        <div key={view} ref={panel} className="my-auto w-full shrink-0">
          {view === 'welcome' && <Link to={authPath()} className="block w-fit" onClick={() => setSignupDraft(null)}>
            <Brand className="w-[160px]" />
          </Link>}
          {verifying && <EmailVerificationForm email={signupDraft.email} onBack={() => setSignupDraft(null)} expiresAt={signupDraft.expiresAt} onVerified={async verificationToken => {
            const result = await api.request<LoginResponse>('/auth/email/signup', { method: 'POST', auth: false, body: { verificationToken, password: signupDraft.password, nickname: signupDraft.nickname, agreedTermVersionIds: backend.terms.filter(term => term.required).map(term => term.termVersionId) } })
            await complete(result)
          }} />}
          <div hidden={verifying}>
            {view === 'welcome' ? (
              <>
                <h1
                  tabIndex={-1}
                  className="mt-6 focus:outline-none type-page-title"
                >
                  같이 공부할 친구가
                  <br />
                  기다리고 있어요
                </h1>
                <p className="mt-4 text-subtle">친구와 함께 공부를 시작해요.</p>
                <div className="mt-7 flex flex-col items-center gap-3">
                  <span id="kakao-signup-note" className="kakao-signup-note">5초만에 빠른 회원가입</span>
                  <Button onClick={kakao} className="kakao-button w-full text-[#241f14]" aria-describedby="kakao-signup-note">
                    <Icon name="chat" size={18} fill="currentColor" /> 카카오로 시작
                  </Button>
                </div>
                <p className="mt-3 text-center text-caption leading-6 text-subtle">
                  시작하면{' '}
                  <button type="button" aria-label="이용약관" onClick={() => setLegal('terms')} className="rounded-sm text-muted transition-colors hover:text-ink">[이용약관]</button>과{' '}
                  <button type="button" aria-label="개인정보 처리방침" onClick={() => setLegal('privacy')} className="rounded-sm text-muted transition-colors hover:text-ink">[개인정보 처리방침]</button>에 동의해요.
                </p>
                <div className="mt-9 flex items-center gap-3 text-caption text-subtle">
                  <span className="h-px flex-1 bg-divider" />
                  또는
                  <span className="h-px flex-1 bg-divider" />
                </div>
                <nav
                  aria-label="이메일 계정 메뉴"
                  className="mt-5 flex items-center justify-center gap-4 text-body-compact"
                >
                  <Link
                    to={authPath('login')}
                    className="text-muted underline underline-offset-4 hover:text-text-accent"
                  >
                    로그인
                  </Link>
                  <span aria-hidden="true" className="text-divider">
                    |
                  </span>
                  <Link
                    to={authPath('signup')}
                    className="text-muted underline underline-offset-4 hover:text-text-accent"
                  >
                    회원가입
                  </Link>
                </nav>
              </>
            ) : (
              <>
                <Link
                  to={authPath(view === 'forgot-password' ? 'login' : undefined)}
                  className="flex min-h-11 w-fit items-center gap-2 text-body-compact text-muted hover:text-text-accent"
                >
                  <Icon name="arrow" size={15} className="rotate-180" />
                  {view === 'forgot-password' ? '로그인' : '처음으로'}
                </Link>
                <h1
                  tabIndex={-1}
                  className="mt-6 focus:outline-none type-page-title"
                >
                  {view === 'signup' ? '회원가입' : view === 'forgot-password' ? '비밀번호 찾기' : '로그인'}
                </h1>
                {view === 'forgot-password' ? <PasswordRecoveryForm /> : (
                  <>
                    <EmailAuthForm
                      mode={view}
                      onSubmit={async input => {
                        if (view === 'signup') {
                          const result = await api.request<ExpiresResponse>('/auth/email/verification', { method: 'POST', auth: false, body: { email: input.email } })
                          if (!result.expiresInSeconds) throw new Error('인증 유효 시간을 확인하지 못했어요.')
                          setSignupDraft({ ...input, expiresAt: Date.now() + result.expiresInSeconds * 1000 })
                        } else {
                          await complete(await api.request<LoginResponse>('/auth/email/login', { method: 'POST', auth: false, body: { email: input.email, password: input.password } }))
                        }
                      }}
                      onOpenDocument={setLegal}
                    />
                    {view === 'login' ? (
                      <nav aria-label="계정 메뉴" className="mt-7 flex items-center justify-center gap-4 text-body-compact text-muted">
                        <Link
                          to={authPath('forgot-password')}
                          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-text-accent"
                        >
                          비밀번호 찾기
                        </Link>
                        <span aria-hidden="true" className="text-divider">|</span>
                        <Link
                          to={authPath('signup')}
                          className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-text-accent"
                        >
                          회원가입
                        </Link>
                      </nav>
                    ) : (
                      <p className="mt-7 text-center text-body-compact text-muted">
                        이미 계정이 있나요?{' '}
                        <Link
                          to={authPath('login')}
                          className="ml-1 text-text-accent underline underline-offset-4"
                        >
                          로그인
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <LegalDocumentDialog document={legal} onClose={() => setLegal(null)} />
      <NotificationStack items={notifications} onDismiss={dismissNotification} />
    </main>
  )
}
