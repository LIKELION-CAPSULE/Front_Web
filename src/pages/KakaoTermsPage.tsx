import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { api } from '@/shared/api/client'
import { deviceHash } from '@/shared/api/device-hash'
import type { KakaoResponse, TermsResponse, TermVersion } from '@/shared/api/types'
import { rememberLoginProvider } from '@/features/auth/auth-storage'
import { postAuthDestination } from '@/features/auth/post-auth'
import { legalTermsReady } from '@/features/auth/legal-terms-ready'
import { legalDocuments, type LegalDocumentId } from '@/features/auth/data/legal-documents'
import { startKakaoLogin } from '@/features/auth/kakao-start'
import { KAKAO_SIGNUP_PATH, kakaoSignupFailure, kakaoSignupRequest } from '@/features/auth/kakao-signup-contract'
import {
  agreedTermVersionIds,
  allConsentState,
  canSubmitConsent,
  clearKakaoSignup,
  consentTerms,
  NO_CONSENT,
  readKakaoSignup,
  toggleAllConsent,
  type ConsentChecks,
} from '@/features/auth/kakao-signup'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'
import { AnimatedCheckbox } from '@/shared/ui/AnimatedCheckbox'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'

type Ended = 'expired' | 'invalid'
type TermsLoad = { status: 'loading' } | { status: 'ready'; terms: TermVersion[] } | { status: 'error' }

/** The ticket as of now (outside render: the submit handler checks it right before sending). */
const readTicketNow = () => readKakaoSignup(Date.now())

const neutralLinkClass = 'inline-flex min-h-11 items-center text-muted underline underline-offset-4 transition-colors hover:text-ink'

/**
 * 「CAPSULE을 시작하기 전에」: a first-time Kakao user reads and agrees to the required terms before the account is made
 * (contract a′, kakao-signup-contract.ts). Opened by the Kakao callback with a sign-up ticket in this tab's session
 * storage; opened without one (typed address, closed tab) it goes back to the login screen.
 */
export default function KakaoTermsPage() {
  const { authenticate } = useBackend()
  const shell = useDesktopShell()
  const navigate = useNavigate()
  const id = useId()
  // Read once on entry. A refresh keeps a live ticket; an expired one shows the restart notice once, then is dropped.
  const [entry] = useState(() => readKakaoSignup(Date.now()))
  const next = entry.status === 'active' ? entry.session.next : entry.status === 'expired' ? entry.next : '/'
  const [ended, setEnded] = useState<Ended | null>(entry.status === 'expired' ? 'expired' : null)
  const [load, setLoad] = useState<TermsLoad>({ status: 'loading' })
  const [checks, setChecks] = useState<ConsentChecks>(NO_CONSENT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [termsChanged, setTermsChanged] = useState(false)
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  const submitting = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const allRef = useRef<HTMLInputElement>(null)

  const terms = useMemo(() => (load.status === 'ready' ? load.terms : []), [load])
  const list = consentTerms(terms)
  const termsReady = load.status === 'ready' && legalTermsReady(terms)
  const all = allConsentState(checks, list)
  const canSubmit = canSubmitConsent({ checks, terms: list, termsReady, busy })

  /** `GET /terms` (public), fresh on every entry and after the server says the agreed versions are not the latest. */
  const fetchTerms = useCallback(() => {
    api.request<TermsResponse>('/terms', { auth: false }).then(
      value => setLoad(Array.isArray(value.terms) ? { status: 'ready', terms: value.terms } : { status: 'error' }),
      () => setLoad({ status: 'error' }),
    )
  }, [])
  const loadTerms = useCallback(() => {
    setLoad({ status: 'loading' })
    fetchTerms()
  }, [fetchTerms])

  useEffect(() => {
    if (entry.status === 'active') fetchTerms()
    if (entry.status === 'expired') clearKakaoSignup()
  }, [entry.status, fetchTerms])

  // No remaining-time display: when the ticket runs out, the screen turns into the restart notice.
  useEffect(() => {
    if (entry.status !== 'active' || ended) return
    const timer = setTimeout(() => { clearKakaoSignup(); setLegal(null); setEnded('expired') }, Math.max(0, entry.session.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [entry, ended])

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = all === 'mixed'
  }, [all])

  const closeLegal = useCallback(() => setLegal(null), [])
  const hasError = Boolean(ended || error || load.status === 'error')
  useEffect(() => {
    shell?.setWindowConfig({
      windowKey: 'kakao-terms',
      windowTitle: 'CAPSULE — 약관 동의',
      windowWidth: 460,
      mode: 'login',
      legalDocument: legal,
      legalTerms: terms.length ? terms : undefined,
      onCloseLegal: closeLegal,
      hasErrorNotification: hasError,
      scrollResetKey: ended ?? 'consent',
    })
  }, [shell, legal, terms, closeLegal, hasError, ended])

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [ended])

  if (entry.status === 'none') return <Navigate to="/login" replace />

  function cancel() {
    clearKakaoSignup()
    navigate('/login', { replace: true })
  }

  function restart() {
    setError('')
    const problem = startKakaoLogin(next)
    if (problem) setError(problem)
  }

  async function submit() {
    if (!canSubmit || submitting.current) return
    const current = readTicketNow()
    if (current.status !== 'active') { clearKakaoSignup(); setLegal(null); setEnded('expired'); return }
    submitting.current = true
    setBusy(true)
    setError('')
    setTermsChanged(false)
    let result: KakaoResponse
    try {
      result = await api.request<KakaoResponse>(KAKAO_SIGNUP_PATH, {
        method: 'POST',
        auth: false,
        body: kakaoSignupRequest({
          signupToken: current.session.signupToken,
          agreedTermVersionIds: agreedTermVersionIds(checks, list),
          deviceHash: await deviceHash(),
        }),
      })
    } catch (reason) {
      submitting.current = false
      setBusy(false)
      const failure = kakaoSignupFailure(reason)
      if (failure === 'expired' || failure === 'invalid') { clearKakaoSignup(); setLegal(null); setEnded(failure); return }
      if (failure === 'beta-full') { clearKakaoSignup(); navigate('/login?mode=waitlist', { replace: true }); return }
      if (failure === 'terms') { setChecks(NO_CONSENT); setTermsChanged(true); loadTerms(); return }
      setError('가입을 마치지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    // The account exists now and the ticket is used up.
    clearKakaoSignup()
    try {
      const me = await authenticate(result)
      rememberLoginProvider('KAKAO')
      window.dispatchEvent(new CustomEvent('capsule-desktop:login-success', { detail: { onboardingRequired: Boolean(me.onboardingRequired) } }))
      navigate(
        me.onboardingRequired ? `/onboarding?next=${encodeURIComponent(next)}` : postAuthDestination({ next, newAccount: true }),
        { replace: true },
      )
    } catch {
      // Signed up but not signed in here: Kakao again now signs in to the new account.
      navigate('/login?notice=kakao-failed', { replace: true })
    }
  }

  if (ended) {
    return (
      <div ref={panel} className="my-auto w-full shrink-0">
        <h1 tabIndex={-1} className="focus:outline-none type-page-title">
          {ended === 'expired' ? '가입 확인 시간이 지났어요' : '가입 요청을 확인하지 못했어요'}
        </h1>
        <FeedbackMessage tone="error" className="mt-4">
          {ended === 'expired'
            ? '안전을 위해 약관 동의는 카카오 확인 뒤 잠시 동안만 할 수 있어요. 카카오로 다시 시작해 주세요.'
            : '이미 사용했거나 확인할 수 없는 요청이에요. 카카오로 다시 시작해 주세요.'}
        </FeedbackMessage>
        <Button onClick={restart} className="kakao-button mt-7 w-full text-[#241f14]">
          <Icon name="chat" size={18} fill="currentColor" /> 카카오로 다시 시작
        </Button>
        {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
        <p className="mt-5 text-center text-body-compact">
          <Link to="/login" replace className={neutralLinkClass}>로그인 화면으로</Link>
        </p>
      </div>
    )
  }

  const allHint = `${id}-all-hint`
  return (
    <div ref={panel} className="my-auto w-full shrink-0">
      <h1 tabIndex={-1} className="focus:outline-none type-page-title">CAPSULE을 시작하기 전에</h1>
      <p className="mt-4 text-subtle">카카오 계정을 확인했어요. 아래 약관에 동의하면 가입이 끝나요.</p>

      <form
        noValidate
        className="mt-7"
        aria-busy={busy || undefined}
        onSubmit={event => { event.preventDefault(); void submit() }}
      >
        {load.status === 'loading' ? (
          <div className="flex min-h-32 items-center gap-3 text-muted" role="status">
            <QuarterRingSpinner />
            <span>약관을 불러오고 있어요.</span>
          </div>
        ) : !termsReady ? (
          <div className="space-y-3">
            <FeedbackMessage tone="error">약관을 불러오지 못했어요. 다시 불러온 뒤 동의해 주세요.</FeedbackMessage>
            <Button variant="secondary" size="md" onClick={loadTerms} className="w-full">약관 다시 불러오기</Button>
          </div>
        ) : (
          <fieldset className="min-w-0 rounded-control border border-divider" disabled={busy}>
            <legend className="sr-only">약관 동의</legend>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
              <AnimatedCheckbox
                ref={allRef}
                checked={all === true}
                aria-describedby={allHint}
                onChange={() => { setChecks(current => toggleAllConsent(current, list)); setTermsChanged(false) }}
              />
              <span className="min-w-0">
                <span className="block type-body font-semibold text-ink">전체 동의</span>
                <span id={allHint} className="block type-caption text-subtle">필수 약관에 모두 동의해요.</span>
              </span>
            </label>
            <div aria-hidden="true" className="mx-4 h-px bg-divider" />
            <ul className="px-4 py-2">
              {list.map(term => (
                <li key={term.document} className="flex items-center justify-between gap-3">
                  <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 type-body-compact text-muted">
                    <AnimatedCheckbox
                      name={term.document === 'terms' ? 'agreeTerms' : 'agreePrivacy'}
                      checked={checks[term.document]}
                      onChange={event => {
                        const value = event.currentTarget.checked
                        setChecks(current => ({ ...current, [term.document]: value }))
                        setTermsChanged(false)
                      }}
                    />
                    <span>(필수) {term.name}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`${legalDocuments[term.document].title} 보기`}
                    onClick={() => setLegal(term.document)}
                    className="min-h-11 shrink-0 px-2 text-caption leading-5 text-muted underline underline-offset-4 transition-colors hover:text-ink"
                  >
                    보기
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {termsChanged && (
          <FeedbackMessage tone="warning" className="mt-4">
            약관이 새로 바뀌었어요. 내용을 다시 확인하고 동의해 주세요.
          </FeedbackMessage>
        )}
        {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}

        <Button type="submit" loading={busy} disabled={!canSubmit} className="mt-7 w-full">
          동의하고 시작하기
        </Button>
        <Button variant="ghost" onClick={cancel} disabled={busy} className="mt-2 w-full">
          취소
        </Button>
      </form>
    </div>
  )
}
