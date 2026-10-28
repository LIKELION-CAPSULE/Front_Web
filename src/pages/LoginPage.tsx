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
import { LegalDocumentDialog } from '@/features/auth/components/LegalDocumentDialog'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'

export default function LoginPage() {
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  const scrollPane = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const mode = params.get('mode')
  const view = mode === 'login' || mode === 'signup' ? mode : 'welcome'
  const next = safeReturnPath(params.get('next'), '/')
  useEffect(() => {
    document.title = `CAPSULE · ${view === 'login' ? '로그인' : view === 'signup' ? '회원가입' : '같이 공부할 친구가 기다리고 있어요'}`
    scrollPane.current?.scrollTo({ top: 0 })
    panel.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [view])
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
          <Link to={authPath()} className="block w-fit">
            <Brand className="w-[160px]" />
          </Link>
          {view === 'welcome' ? (
            <>
              <h1
                tabIndex={-1}
                className="mt-6 text-[30px] leading-[1.35] font-bold focus:outline-none"
              >
                같이 공부할 친구가
                <br />
                기다리고 있어요
              </h1>
              <p className="mt-4 text-subtle">3초 만에 시작하기</p>
              <Button onClick={() => login()} className="kakao-button mt-7 w-full text-[#241f14]">
                <Icon name="chat" size={18} fill="currentColor" /> 카카오로 계속하기
              </Button>
              <button
                onClick={() => login(true)}
                type="button"
                className="button-subtle mt-4 w-full rounded-control border border-transparent px-4 py-3 text-sm text-muted"
              >
                더미 계정으로 바로 둘러보기
              </button>
              <div className="mt-9 flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-line" />
                또는
                <span className="h-px flex-1 bg-line" />
              </div>
              <nav
                aria-label="이메일 계정 메뉴"
                className="mt-5 flex items-center justify-center gap-4 text-sm"
              >
                <Link
                  to={authPath('login')}
                  className="text-muted underline underline-offset-4 hover:text-brand-strong"
                >
                  로그인
                </Link>
                <span aria-hidden="true" className="text-line">
                  |
                </span>
                <Link
                  to={authPath('signup')}
                  className="text-muted underline underline-offset-4 hover:text-brand-strong"
                >
                  회원가입
                </Link>
              </nav>
            </>
          ) : (
            <>
              <Link
                to={authPath()}
                className="mt-5 flex w-fit items-center gap-2 text-sm text-muted hover:text-brand-strong"
              >
                <Icon name="arrow" size={15} className="rotate-180" />
                처음으로
              </Link>
              <h1
                tabIndex={-1}
                className="mt-6 text-[30px] leading-[1.35] font-bold focus:outline-none"
              >
                {view === 'signup' ? '회원가입' : '로그인'}
              </h1>
              <EmailAuthForm
                mode={view}
                onSubmit={() => login(false, view === 'signup')}
                onOpenDocument={setLegal}
              />
              <p className="mt-7 text-center text-sm text-muted">
                {view === 'signup' ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
                <Link
                  to={authPath(view === 'signup' ? 'login' : 'signup')}
                  className="ml-1 text-brand-strong underline underline-offset-4"
                >
                  {view === 'signup' ? '로그인' : '회원가입'}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
      <LegalDocumentDialog document={legal} onClose={() => setLegal(null)} />
    </main>
  )
}
