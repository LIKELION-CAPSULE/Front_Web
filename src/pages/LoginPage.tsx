import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api, ApiError } from '@/shared/api/client'
import type { EmailRequest, ExpiresResponse, LoginRequest, LoginResponse } from '@/shared/api/types'
import { authNotice } from '@/features/auth/auth-notices'
import { rememberLoginProvider, saveKakaoLogin } from '@/features/auth/auth-storage'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationContent, type NotificationItem } from '@/shared/ui/notification-queue'
import { postAuthDestination } from '@/features/auth/post-auth'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { EmailAuthForm, type EmailAuthMode } from '@/features/auth/components/EmailAuthForm'
import { EmailVerificationForm } from '@/features/auth/components/EmailVerificationForm'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'
import { BetaWaitlistForm } from '@/features/auth/components/BetaWaitlistForm'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'
import { legalTermsReady } from '@/features/auth/legal-terms-ready'
import { birthDateError } from '@/features/auth/birth-date'
import { clearStoredReferralCode } from '@/features/auth/referral-code'
import DesktopBrand from '@/features/auth/login-backgrounds/desktop/DesktopBrand'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'

/** Text links in the login form: one neutral tone; only 회원가입 keeps the accent color. Focus uses the global ring. */
const neutralLinkClass = 'inline-flex min-h-11 items-center text-muted underline underline-offset-4 transition-colors hover:text-ink'
const signupLinkClass = 'inline-flex min-h-11 items-center text-text-accent underline underline-offset-4'

function loginWindowTitle(
  view: 'welcome' | 'login' | 'signup' | 'forgot-password' | 'waitlist',
  verifying: boolean,
): string {
  if (verifying) return 'CAPSULE — 이메일 인증'
  if (view === 'waitlist') return 'CAPSULE — 출시 알림'
  if (view === 'login') return 'CAPSULE — 로그인'
  if (view === 'signup') return 'CAPSULE — 회원가입'
  if (view === 'forgot-password') return 'CAPSULE — 비밀번호 찾기'
  return 'CAPSULE — 시작하기'
}

export default function LoginPage() {
  const backend = useBackend()
  const desktopShell = useDesktopShell()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  const [signupDraft, setSignupDraft] = useState<{
    email: string
    password: string
    nickname: string
    birthDate: string
    referralCode?: string
    expiresAt: number
  } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const mode = params.get('mode')
  const view = params.has('token')
    ? 'forgot-password'
    : mode === 'login' || mode === 'signup' || mode === 'forgot-password' || mode === 'waitlist'
      ? mode
      : 'welcome'
  const verifying = view === 'signup' && signupDraft !== null
  // Signing in again: back to `next`; a new account goes through onboarding, which applies the new-account rule.
  const next = postAuthDestination({ next: params.get('next'), newAccount: false })
  const noticeCode = params.get('notice')
  const hasErrorNotification = notifications.some((item) => item.tone === 'error')

  const closeLegal = useCallback(() => setLegal(null), [])
  const handleReferralValid = useCallback(() => {
    desktopShell?.triggerReaction('referralValid', { revertAfterMs: 4600 })
  }, [desktopShell])

  // Sync window title, legal document, and error state to the login layout (LoginVariantLayout provides the shell)
  useEffect(() => {
    if (!desktopShell) return
    desktopShell.setWindowConfig({
      windowKey: 'login',
      windowTitle: loginWindowTitle(view, verifying),
      windowWidth: 460,
      mode: 'login',
      legalDocument: legal,
      onCloseLegal: closeLegal,
      hasErrorNotification,
      scrollResetKey: `${view}:${verifying}`,
    })
  }, [desktopShell, view, verifying, legal, closeLegal, hasErrorNotification])

  const showNotification = useCallback((content: NotificationContent) => {
    const item = { ...content, id: crypto.randomUUID() }
    setNotifications((current) => enqueueNotification(current, item))
  }, [])
  const dismissNotification = useCallback(
    (id: string) => setNotifications((current) => current.filter((item) => item.id !== id)),
    [],
  )
  useEffect(() => {
    document.title = `CAPSULE · ${verifying ? '이메일 인증' : view === 'login' ? '로그인' : view === 'signup' ? '회원가입' : view === 'forgot-password' ? '비밀번호 찾기' : view === 'waitlist' ? '출시 알림' : '나만의 메이트가 기다리고 있어요'}`
    panel.current
      ?.querySelector<HTMLElement>(verifying ? 'input[autocomplete="one-time-code"]' : 'h1')
      ?.focus({ preventScroll: true })
  }, [view, verifying])
  useEffect(() => {
    if (!noticeCode || params.has('token')) return
    const notice = authNotice(noticeCode)
    const search = new URLSearchParams(params)
    search.delete('notice')
    // Mount the destination first so its result can enter and be announced separately.
    const frame = requestAnimationFrame(() => {
      if (notice) showNotification(notice)
      navigate(
        { pathname: location.pathname, search: search.size ? `?${search}` : '', hash: location.hash },
        { replace: true, state: location.state },
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [noticeCode, params, location.pathname, location.hash, location.state, navigate, showNotification])
  function authPath(target?: EmailAuthMode | 'forgot-password' | 'waitlist') {
    const search = new URLSearchParams(params)
    if (target !== 'forgot-password') search.delete('token')
    if (target) search.set('mode', target)
    else search.delete('mode')
    return `/login${search.size ? `?${search}` : ''}`
  }
  async function complete(result: LoginResponse, registeredReferral = false) {
    const me = await backend.authenticate(result)
    setSignupDraft(null)
    if (registeredReferral) clearStoredReferralCode()
    rememberLoginProvider('EMAIL')
    window.dispatchEvent(
      new CustomEvent('capsule-desktop:login-success', {
        detail: { onboardingRequired: Boolean(me.onboardingRequired) },
      }),
    )
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) await new Promise((resolve) => setTimeout(resolve, me.onboardingRequired ? 450 : 750))
    navigate(
      me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : next,
      { replace: true },
    )
  }
  function kakao() {
    const showError = (text: string) => showNotification({ tone: 'error', title: '카카오 로그인 오류', text })
    const key = import.meta.env.VITE_KAKAO_REST_API_KEY as string | undefined
    const redirect = import.meta.env.VITE_KAKAO_REDIRECT_URI as string | undefined
    if (!key || !redirect) {
      showError('카카오 로그인을 준비하고 있어요. 이메일로 로그인해 주세요.')
      return
    }
    if (!legalTermsReady(backend.terms)) {
      showError('약관 정보를 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.')
      return
    }
    try {
      if (new URL(redirect).origin !== window.location.origin) {
        showError('현재 접속 주소에서 카카오 로그인을 사용할 수 없어요. 로그인 페이지 주소를 확인해 주세요.')
        return
      }
    } catch {
      showError('카카오 로그인 주소를 확인하지 못했어요. 이메일로 로그인해 주세요.')
      return
    }
    const state = crypto.randomUUID()
    if (!saveKakaoLogin({ state, next, redirect })) {
      showError('브라우저 저장소를 사용할 수 없어 카카오 로그인을 시작하지 못했어요. 저장소를 허용하거나 이메일로 로그인해 주세요.')
      return
    }
    const query = new URLSearchParams({
      client_id: key,
      redirect_uri: redirect,
      response_type: 'code',
      state,
    })
    window.location.assign(`https://kauth.kakao.com/oauth/authorize?${query}`)
  }
  if (params.has('token')) return <Navigate to={`/password/reset?${params}`} replace />

  const formContent = (
    <div key={view} ref={panel} className="my-auto w-full shrink-0">
      {view === 'welcome' && (
        <Link to={authPath()} className="block w-fit" onClick={() => setSignupDraft(null)}>
          <DesktopBrand />
        </Link>
      )}
      {verifying && (
        <EmailVerificationForm
          email={signupDraft.email}
          onBack={() => setSignupDraft(null)}
          expiresAt={signupDraft.expiresAt}
          onVerified={async (verificationToken) => {
            const error = birthDateError(signupDraft.birthDate)
            if (error) throw new Error(error)
            if (!legalTermsReady(backend.terms))
              throw new Error('약관 정보를 불러오지 못했어요. 페이지를 새로고침해 다시 시도해 주세요.')
            if (!backend.betaSignup) throw new Error('요청을 처리하지 못했어요.')
            let result: LoginResponse
            try {
              result = await backend.betaSignup({
              verificationToken,
              password: signupDraft.password,
              nickname: signupDraft.nickname,
              birthDate: signupDraft.birthDate,
              agreedTermVersionIds: backend.terms
                .filter((term) => term.required)
                .map((term) => term.termVersionId!),
              ...(signupDraft.referralCode ? { referralCode: signupDraft.referralCode } : {}),
              })
            } catch (reason) {
              // The beta is full (4 → 403 BETA_FULL): the launch notice sign-up instead, with this email filled in.
              if (reason instanceof ApiError && reason.code === 'BETA_FULL') {
                const email = signupDraft.email
                setSignupDraft(null)
                navigate(authPath('waitlist'), { state: { waitlistEmail: email } })
                return
              }
              throw reason
            }
            await complete(result, Boolean(signupDraft.referralCode))
          }}
        />
      )}
      <div hidden={verifying}>
        {view === 'waitlist' ? (
          <BetaWaitlistForm
            defaultEmail={typeof (location.state as { waitlistEmail?: unknown } | null)?.waitlistEmail === 'string' ? (location.state as { waitlistEmail: string }).waitlistEmail : ''}
            onBack={() => navigate(authPath('login'), { replace: true })}
          />
        ) : view === 'welcome' ? (
          <>
            <h1 tabIndex={-1} className="mt-6 focus:outline-none type-page-title">
              나만의 메이트가
              <br />
              기다리고 있어요
            </h1>
            <p className="mt-4 text-subtle">노트북 앞의 시간을 함께 보내요.</p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <span id="kakao-signup-note" className="kakao-signup-note">
                5초만에 빠른 회원가입
              </span>
              <Button
                onClick={kakao}
                className="kakao-button w-full text-[#241f14]"
                aria-describedby="kakao-signup-note"
              >
                <Icon name="chat" size={18} fill="currentColor" /> 카카오로 시작
              </Button>
            </div>
            <p className="mt-3 text-center text-caption leading-6 text-subtle">
              시작하면{' '}
              <button
                type="button"
                aria-label="이용약관"
                onClick={() => setLegal('terms')}
                className="rounded-sm text-muted transition-colors hover:text-ink"
              >
                [이용약관]
              </button>
              과{' '}
              <button
                type="button"
                aria-label="개인정보 처리방침"
                onClick={() => setLegal('privacy')}
                className="rounded-sm text-muted transition-colors hover:text-ink"
              >
                [개인정보 처리방침]
              </button>
              에 동의해요.
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
              <Link to={authPath('login')} className={neutralLinkClass}>
                로그인
              </Link>
              <span aria-hidden="true" className="text-divider">
                |
              </span>
              <Link to={authPath('signup')} className={signupLinkClass}>
                회원가입
              </Link>
            </nav>
          </>
        ) : (
          <>
            <Link
              to={authPath(view === 'forgot-password' ? 'login' : undefined)}
              className="flex min-h-11 w-fit items-center gap-2 text-body-compact text-muted transition-colors hover:text-ink"
            >
              <Icon name="arrow" size={15} className="rotate-180" />
              {view === 'forgot-password' ? '로그인' : '처음으로'}
            </Link>
            <h1 tabIndex={-1} className="mt-6 focus:outline-none type-page-title">
              {view === 'signup' ? '회원가입' : view === 'forgot-password' ? '비밀번호 찾기' : '로그인'}
            </h1>
            {view === 'forgot-password' ? (
              <PasswordRecoveryForm />
            ) : (
              <>
                <EmailAuthForm
                  mode={view}
                  onReferralValid={handleReferralValid}
                  onSubmit={async (input) => {
                    if (view === 'signup') {
                      // Never discard a required birth date and create an account through the old contract.
                      if (!backend.betaSignup) throw new Error('요청을 처리하지 못했어요.')
                      const result = await api.request<ExpiresResponse>('/auth/email/verification', {
                        method: 'POST',
                        auth: false,
                        body: { email: input.email } satisfies EmailRequest,
                      })
                      if (!result.expiresInSeconds)
                        throw new Error('인증 유효 시간을 확인하지 못했어요.')
                      setSignupDraft({
                        ...input,
                        expiresAt: Date.now() + result.expiresInSeconds * 1000,
                      })
                    } else {
                      await complete(
                        await api.request<LoginResponse>('/auth/email/login', {
                          method: 'POST',
                          auth: false,
                          body: { email: input.email, password: input.password } satisfies LoginRequest,
                        }),
                      )
                    }
                  }}
                  onOpenDocument={setLegal}
                />
                {view === 'login' ? (
                  <nav
                    aria-label="계정 메뉴"
                    className="mt-7 flex items-center justify-center gap-4 text-body-compact text-muted"
                  >
                    <Link
                      to={authPath('forgot-password')}
                      className={neutralLinkClass}
                    >
                      비밀번호 찾기
                    </Link>
                    <span aria-hidden="true" className="text-divider">
                      |
                    </span>
                    <Link
                      to={authPath('signup')}
                      className={signupLinkClass}
                    >
                      회원가입
                    </Link>
                  </nav>
                ) : (
                  <p className="mt-7 text-center text-body-compact text-muted">
                    이미 계정이 있나요?{' '}
                    <Link to={authPath('login')} className={`ml-1 ${neutralLinkClass}`}>
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
  )

  return (
    // The layout (LoginVariantLayout) already provides `<main id="main-content">`; this is only a wrapper inside it.
    <>
      {formContent}
      <NotificationStack items={notifications} onDismiss={dismissNotification} />
    </>
  )
}
