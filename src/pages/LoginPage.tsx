import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { PageNavigation } from '@/app/PageNavigation'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import { authPosters } from '@/features/auth/posters'
import { PosterMosaic } from '@/shared/ui/poster-mosaic/PosterMosaic'
import { EmailAuthForm, type EmailAuthMode } from '@/features/auth/components/EmailAuthForm'
import { EmailVerificationForm } from '@/features/auth/components/EmailVerificationForm'
import { LegalDocumentDialog } from '@/features/auth/components/LegalDocumentDialog'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'

export default function LoginPage() {
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const scrollPane = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const mode = params.get('mode')
  const view = mode === 'login' || mode === 'signup' ? mode : 'welcome'
  const verifying = view === 'signup' && verificationEmail !== null
  const next = safeReturnPath(params.get('next'), '/')
  useEffect(() => {
    document.title = `CAPSULE · ${verifying ? '이메일 인증' : view === 'login' ? '로그인' : view === 'signup' ? '회원가입' : '같이 공부할 친구가 기다리고 있어요'}`
    scrollPane.current?.scrollTo({ top: 0 })
    panel.current?.querySelector<HTMLElement>(verifying ? 'input[autocomplete="one-time-code"]' : 'h1')?.focus({ preventScroll: true })
  }, [view, verifying])
  function authPath(target?: EmailAuthMode) {
    const search = new URLSearchParams(params)
    if (target) search.set('mode', target)
    else search.delete('mode')
    return `/login${search.size ? `?${search}` : ''}`
  }
  function login(preview = false, signup = false) {
    dispatch({ type: 'LOGIN', preview })
    navigate(
      !signup && (preview || state.profile.onboarded)
        ? next
        : `/onboarding?next=${encodeURIComponent(next)}`,
    )
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="login-page grid h-dvh min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden focus:outline-none"
    >
      <PageNavigation />
      <section
        aria-label="캡슐 공부 공간 소개"
        className="login-world relative min-h-0 min-w-0 overflow-hidden"
      >
        <div className="absolute inset-0">
          <PosterMosaic images={authPosters} />
        </div>
      </section>
      <section
        ref={scrollPane}
        aria-label="로그인 및 회원가입"
        className="login-scroll-pane flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-y-contain px-6 py-16 sm:px-12 lg:px-8 xl:px-10 2xl:px-16"
      >
        <div key={view} ref={panel} className="mx-auto my-auto w-full max-w-[452px] shrink-0">
          <Link to={authPath()} className="block w-fit" onClick={() => setVerificationEmail(null)}>
            <Brand className="w-[160px]" />
          </Link>
          {verifying && <EmailVerificationForm email={verificationEmail} onBack={() => setVerificationEmail(null)} onVerified={() => login(false, true)} />}
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
                <Button onClick={() => login()} className="kakao-button mt-7 w-full text-[#241f14]">
                  <Icon name="chat" size={18} fill="currentColor" /> 카카오로 계속하기
                </Button>
                <Button
                  onClick={() => login(true)}
                  variant="secondary"
                  className="mt-4 w-full"
                >
                  가입 없이 둘러보기
                </Button>
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
                  to={authPath()}
                  className="mt-5 flex w-fit items-center gap-2 text-body-compact text-muted hover:text-text-accent"
                >
                  <Icon name="arrow" size={15} className="rotate-180" />
                  처음으로
                </Link>
                <h1
                  tabIndex={-1}
                  className="mt-6 focus:outline-none type-page-title"
                >
                  {view === 'signup' ? '회원가입' : '로그인'}
                </h1>
                <EmailAuthForm
                  mode={view}
                  onSubmit={(email) => {
                    if (view === 'signup') setVerificationEmail(email)
                    else login()
                  }}
                  onOpenDocument={setLegal}
                />
                <p className="mt-7 text-center text-body-compact text-muted">
                  {view === 'signup' ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
                  <Link
                    to={authPath(view === 'signup' ? 'login' : 'signup')}
                    className="ml-1 text-text-accent underline underline-offset-4"
                  >
                    {view === 'signup' ? '로그인' : '회원가입'}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
      <LegalDocumentDialog document={legal} onClose={() => setLegal(null)} />
    </main>
  )
}
