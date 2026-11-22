import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'
import { clearPasswordResetBootstrap, initialPasswordResetLocation } from '@/features/auth/password-reset-bootstrap'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { ButtonLink } from '@/shared/ui/Button'
import DesktopBrand from '@/features/auth/login-backgrounds/desktop/DesktopBrand'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'

const NOOP = () => {}

export default function PasswordResetPage() {
  const desktopShell = useDesktopShell()
  const [reset] = useState(initialPasswordResetLocation)
  const [done, setDone] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const { forgetAuthentication } = useBackend()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    clearPasswordResetBootstrap()
    if (reset.token) navigate(reset.cleanPath, { replace: true })
  }, [navigate, reset])

  useEffect(() => {
    document.title = `CAPSULE · ${done ? '비밀번호 변경 완료' : '비밀번호 재설정'}`
    if (done) heading.current?.focus({ preventScroll: true })
  }, [done])

  useEffect(() => {
    if (!desktopShell) return
    desktopShell.setWindowConfig({
      windowKey: 'password-reset',
      windowTitle: 'CAPSULE — 비밀번호 재설정',
      windowWidth: 460,
      mode: 'password-reset',
      legalDocument: null,
      onCloseLegal: NOOP,
      hasErrorNotification: false,
      scrollResetKey: `reset:${done}`,
    })
  }, [desktopShell, done])

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <Link to="/login" aria-label="CAPSULE 로그인" className="block w-fit">
        <DesktopBrand />
      </Link>
      <h1
        ref={heading}
        tabIndex={-1}
        className={`mt-6 type-page-title focus:outline-none${done ? ' text-center' : ''}`}
      >
        {done ? '비밀번호 변경 완료' : '비밀번호 재설정'}
      </h1>
      {done ? (
        <ButtonLink to="/login?mode=login" replace className="mt-6 w-full">
          로그인
        </ButtonLink>
      ) : reset.token ? (
        <PasswordRecoveryForm
          token={reset.token}
          onReset={() => {
            forgetAuthentication()
            setDone(true)
          }}
        />
      ) : (
        <>
          <FeedbackMessage tone="error" className="mt-5">
            재설정 링크를 확인하지 못했어요. 새 링크를 받아 주세요.
          </FeedbackMessage>
          <Link
            to="/login?mode=forgot-password"
            className="mt-5 inline-flex min-h-11 items-center text-text-accent underline"
          >
            재설정 링크 다시 받기
          </Link>
        </>
      )}
    </main>
  )
}
