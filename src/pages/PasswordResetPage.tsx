import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'
import { clearPasswordResetBootstrap, initialPasswordResetLocation } from '@/features/auth/password-reset-bootstrap'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Brand } from '@/shared/ui/Brand'
import { ButtonLink } from '@/shared/ui/Button'

export default function PasswordResetPage() {
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
  return <main id="main-content" className="page-container grid min-h-dvh place-items-center py-10">
    <section className="w-full max-w-[452px]">
      <Link to="/login" aria-label="CAPSULE 로그인"><Brand className="mb-8 w-40" /></Link>
      <h1 ref={heading} tabIndex={-1} className={`type-page-title focus:outline-none${done ? ' text-center' : ''}`}>{done ? '비밀번호 변경 완료' : '비밀번호 재설정'}</h1>
      {done ? <ButtonLink to="/login?mode=login" replace className="mt-6 w-full">로그인</ButtonLink> : reset.token ? <PasswordRecoveryForm token={reset.token} onReset={() => {
        forgetAuthentication()
        setDone(true)
      }} /> : <>
        <FeedbackMessage tone="error" className="mt-5">재설정 링크를 확인하지 못했어요. 새 링크를 받아 주세요.</FeedbackMessage>
        <Link to="/login?mode=forgot-password" className="mt-5 inline-flex min-h-11 items-center text-text-accent underline">재설정 링크 다시 받기</Link>
      </>}
    </section>
  </main>
}
