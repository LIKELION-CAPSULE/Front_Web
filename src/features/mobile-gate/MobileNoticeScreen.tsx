import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { AI_NOTICE } from '@/app/components/SiteFooter'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments, type LegalDocumentId } from '@/features/auth/data/legal-documents'
import { readStoredReferralCode } from '@/features/auth/referral-code'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { Brand } from '@/shared/ui/Brand'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import { PixelImage } from '@/shared/ui/pixel/PixelFrame'
import { pixelArtSize, pixelArtUrl, type PixelArt } from '@/shared/ui/pixel/pixel-art'
import { MOBILE_GATE_DIGITS, MOBILE_GATE_FEATURES } from './feature-icons'
import { PC_START_TITLE, pcStartSteps } from './pc-steps'
import { PhoneDozeScene } from './PhoneDozeScene'
import { buildMobileShareUrl, resolveMobileInvite, type MobileInvite } from './share-link'
import './mobile-gate.css'

/**
 * Mobile access screen (SCR-40; design M2 「스크롤 소개」, user decision 2026-11-27). What a phone sees for every path
 * except the password-reset links (MobileAccessGate). The first screen is exactly one phone screen: the login screen's
 * dozing 채린, the headline, the invite card when the visit came from an invite link, and 「PC로 링크 보내기」·「링크 복사」.
 * Scrolling shows three feature cards, the three 「PC에서 이렇게 시작해요」 steps, the legal links and the AI notice. Once the first screen's
 * buttons have scrolled away, a bar with the same two actions is fixed to the bottom (and leaves when they come back).
 * Lazy-loaded by MobileAccessGate, so the desktop app never downloads it.
 */

const COPY = {
  headline: '나만의 메이트가 기다리고 있어요',
  intro: '영상통화처럼 곁에 있는 메이트와 목소리로 이야기하고, 함께한 시간을 기록해요.',
  share: 'PC로 링크 보내기',
  copy: '링크 복사',
} as const

/** How long a status line stays on the bottom bar (the live region in the first screen keeps it for screen readers). */
const BAR_STATUS_MS = 3200

function FeaturePixel({ art }: { art: PixelArt }) {
  return <span className="mg-px" style={{ ...pixelArtSize(art, 2), backgroundImage: pixelArtUrl(art) }} aria-hidden="true" />
}

function InviteCard({ invite }: { invite: MobileInvite }) {
  return (
    <section className="mg-invite" aria-label="초대 코드">
      <PixelImage name="capsule" scale={2} className="mg-invite-capsule" />
      <p className="mg-invite-title">
        {invite.inviter
          ? <><strong>{invite.inviter}님</strong>의 초대 코드가 저장됐어요</>
          : <>초대 코드 <strong>{invite.code}</strong>가 저장됐어요</>}
      </p>
      <p className="mg-invite-reward">
        <PixelImage name="coin" scale={2} />
        <span>PC에서 가입하고 첫 연결을 마치면 둘 다 <em>1,000 크레딧</em></span>
      </p>
      {invite.inviter && <p className="mg-invite-code">코드 {invite.code}</p>}
    </section>
  )
}

/** Watches the first screen's buttons: true once they are out of the viewport. */
function useOutOfView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [out, setOut] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { if (entry) setOut(!entry.isIntersecting) })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, out] as const
}

export default function MobileNoticeScreen() {
  const location = useLocation()
  const reduced = useReducedMotion()
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [barStatus, setBarStatus] = useState('')
  const headingId = useId()
  const featuresId = useId()
  const [actionsRef, barShown] = useOutOfView<HTMLDivElement>()
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    document.body.dataset.mobileNotice = 'true'
    return () => {
      delete document.body.dataset.mobileNotice
    }
  }, [])

  useEffect(() => {
    if (!barStatus) return
    const timer = window.setTimeout(() => setBarStatus(''), BAR_STATUS_MS)
    return () => window.clearTimeout(timer)
  }, [barStatus])

  const invite = useMemo(() => resolveMobileInvite(location.search, readStoredReferralCode()), [location.search])
  const code = invite?.code ?? null
  const steps = useMemo(() => pcStartSteps(invite !== null), [invite])
  const shareUrl = useMemo(
    () => typeof window === 'undefined' ? '' : buildMobileShareUrl(window.location.origin, location.pathname, location.search, location.hash, code),
    [location.pathname, location.search, location.hash, code],
  )

  function report(message: string) {
    setStatusMessage(message)
    setBarStatus(message)
  }

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const input = document.createElement('textarea')
        input.value = shareUrl
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      report('링크를 복사했어요.')
    } catch {
      report('링크를 복사하지 못했어요. 주소창에서 직접 복사해 주세요.')
    }
  }

  /** The phone's share sheet (카카오톡 나에게 보내기, 메일 …); without one, copy. */
  async function sendToPc() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'CAPSULE', text: '캡슐은 PC에서 만날 수 있어요', url: shareUrl })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyLink()
  }

  function showFeatures() {
    const section = document.getElementById(featuresId)
    if (!section) return
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }

  return <>
    <main
      id="main-content"
      tabIndex={-1}
      className="mg-root"
      data-mobile-notice="scr-40"
      data-invite={invite ? 'true' : undefined}
      data-share={canNativeShare ? 'true' : undefined}
    >
      <section className="mg-first" aria-labelledby={headingId}>
        <PhoneDozeScene className="mg-first-scene" deskFront={0.12} minModelWidth={560} headMargin={0.08} />
        <Brand className="mg-brand" />
        <div className="mg-hero">
          <h1 id={headingId} className="mg-headline">{COPY.headline}</h1>
          {!invite && <p className="mg-intro">{COPY.intro}</p>}
          {invite && <InviteCard invite={invite} />}
          <div ref={actionsRef} className="mg-actions">
            {canNativeShare && (
              <Button className="w-full" onClick={() => { void sendToPc() }}>{COPY.share}</Button>
            )}
            <Button variant={canNativeShare ? 'secondary' : 'primary'} className="w-full" onClick={() => { void copyLink() }}>
              {COPY.copy}
            </Button>
          </div>
          {statusMessage && <p role="status" className="mg-status">{statusMessage}</p>}
        </div>
        <button type="button" className="mg-more" onClick={showFeatures}>
          <span>캡슐 둘러보기</span>
          <span className="mg-more-arrow" aria-hidden="true" />
        </button>
      </section>

      <section id={featuresId} tabIndex={-1} className="mg-features" aria-labelledby={`${featuresId}-title`}>
        <h2 id={`${featuresId}-title`} className="mg-section-title">노트북 앞, 메이트와 보내는 시간</h2>
        <ul className="mg-cards">
          {MOBILE_GATE_FEATURES.map(feature => (
            <li key={feature.title} className="mg-card">
              <span className="mg-card-tile"><FeaturePixel art={feature.art} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
        <section className="mg-steps" aria-labelledby={`${featuresId}-steps`}>
          <h3 id={`${featuresId}-steps`} className="mg-steps-title">{PC_START_TITLE}</h3>
          <ol className="mg-steps-list">
            {steps.map((step, index) => (
              <li key={step.title} className="mg-step">
                <span className="mg-step-num">
                  <FeaturePixel art={MOBILE_GATE_DIGITS[index]!} />
                </span>
                <span className="mg-step-text">
                  <span className="mg-step-title">{step.title}</span>
                  {step.note && <span className="mg-step-note">{step.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <footer className="mg-footer">
          <nav aria-label="약관 안내" className="mg-legal">
            <button type="button" onClick={() => setLegalDoc('terms')}>이용약관</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setLegalDoc('privacy')}>개인정보 처리방침</button>
          </nav>
          <p className="mg-ai-notice">{AI_NOTICE}</p>
        </footer>
      </section>

      {/* The first screen's two actions once they have scrolled away. `inert` while hidden: out of the tab order. */}
      <div className="mg-dock" data-visible={barShown || undefined} inert={!barShown} role="group" aria-label="링크 보내기">
        {barStatus && <p className="mg-dock-status" aria-hidden="true">{barStatus}</p>}
        <div className="mg-dock-actions">
          {canNativeShare ? <>
            <Button className="mg-dock-share" onClick={() => { void sendToPc() }}>{COPY.share}</Button>
            <Button variant="secondary" className="mg-dock-copy" aria-label={COPY.copy} title={COPY.copy} onClick={() => { void copyLink() }}>
              <Icon name="copy" size={20} />
            </Button>
          </> : (
            <Button className="mg-dock-share" onClick={() => { void copyLink() }}>{COPY.copy}</Button>
          )}
        </div>
      </div>
    </main>

    <Dialog
      open={legalDoc !== null}
      onClose={() => setLegalDoc(null)}
      title={legalDoc ? legalDocuments[legalDoc].title : ''}
      className="mg-legal-dialog"
    >
      {legalDoc && <LegalDocumentBody document={legalDoc} />}
    </Dialog>
  </>
}
