import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { PageNavigation } from '@/app/PageNavigation'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { DemoNotice } from '@/shared/ui/DemoNotice'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import classroom from '@/assets/rooms/classroom.webp'
import night from '@/assets/rooms/night-study.webp'
import cat from '@/assets/rooms/cat-library.webp'
import fantasy from '@/assets/rooms/fantasy.webp'

export default function LoginPage() {
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [emailOpen, setEmailOpen] = useState(false)
  const [legal, setLegal] = useState('')
  const next = safeReturnPath(params.get('next'), '/')
  function login(preview = false) {
    dispatch({ type: 'LOGIN', preview })
    navigate(
      preview || state.profile.onboarded ? next : `/onboarding?next=${encodeURIComponent(next)}`,
    )
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="login-page grid min-h-dvh focus:outline-none lg:grid-cols-2"
    >
      <PageNavigation />
      <section className="login-world relative hidden min-h-[800px] flex-col justify-end overflow-hidden p-12 lg:flex">
        <div className="login-poster-wall" aria-hidden="true">
          {[classroom, night, cat, fantasy, classroom, night].map((src, index) => (
            <img key={index} src={src} alt="" />
          ))}
        </div>
        <div className="relative z-10 max-w-[484px]">
          <p className="eyebrow mb-5">
            <Icon name="sparkle" size={16} /> A LITTLE CLOSER, EVERY DAY
          </p>
          <h2 className="text-[34px] leading-[1.25] font-black">
            혼자 하는 공부,
            <br />
            이제 같이 해요
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">
            캐릭터가 옆에서 같이 공부하고, 딴짓하면 알아채고, 돌아오면 반겨줘요.
          </p>
        </div>
      </section>
      <section className="flex items-center px-6 py-16 sm:px-12 lg:px-[72px]">
        <div className="mx-auto w-full max-w-[452px] lg:mx-0">
          <Link to="/login" className="inline-block">
            <Brand className="w-[160px]" />
          </Link>
          <p className="eyebrow mt-12">WELCOME TO YOUR CAPSULE</p>
          <h1 className="mt-5 text-[30px] leading-[1.35] font-bold">
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
            className="mt-4 w-full rounded-control border border-line px-4 py-3 text-sm text-muted hover:bg-surface"
          >
            더미 계정으로 바로 둘러보기
          </button>
          <div className="mt-9 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            onClick={() => setEmailOpen(!emailOpen)}
            type="button"
            aria-expanded={emailOpen}
            className="mt-5 text-muted underline underline-offset-4"
          >
            이메일로 시작하기
          </button>
          {emailOpen && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                login()
              }}
              className="mt-4 space-y-3"
            >
              <label className="block text-sm">
                이메일
                <input
                  aria-label="이메일"
                  type="email"
                  required
                  placeholder="hello@example.com"
                  className="form-input mt-2"
                />
              </label>
              <Button type="submit" className="w-full">
                이메일로 계속하기
              </Button>
            </form>
          )}
          <p className="mt-8 text-sm leading-6 text-subtle">
            시작하면{' '}
            <button
              type="button"
              onClick={() => setLegal('이용약관')}
              className="text-ink underline"
            >
              이용약관
            </button>
            과{' '}
            <button
              type="button"
              onClick={() => setLegal('개인정보 처리방침')}
              className="text-ink underline"
            >
              개인정보 처리방침
            </button>
            에 동의하게 돼요. 카메라 사용은 공부를 시작할 때 따로 물어봐요.
          </p>
          <DemoNotice />
        </div>
      </section>
      <Dialog open={!!legal} onClose={() => setLegal('')} title={legal}>
        <p className="text-sm leading-7 text-muted">
          와이어프레임 체험을 위한 데모예요. 실제 회원가입이나 카메라 촬영, 외부 결제를 진행하지
          않으며 입력 내용은 이 브라우저에만 남아요. 정식 서비스의 {legal}은 서비스 출시 전에 별도로
          안내할 예정이에요.
        </p>
      </Dialog>
    </main>
  )
}
