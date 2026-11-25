import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments, type LegalDocumentId } from '@/features/auth/data/legal-documents'
import { readStoredReferralCode } from '@/features/auth/referral-code'
import {
  STATIC_FALLBACK_WALLPAPERS,
  TIME_OF_DAY_PALETTES,
  resolveTimeBand,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { CALL_STAGE_GRADIENT, chaerinArtwork } from '@/features/mates/artwork'
import { isMobileGateAllowedPath, isPhoneDevice, isReviewMobileNoticeForced } from '@/shared/lib/mobile-gate'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import './mobile-notice.css'
import '@/features/auth/login-backgrounds/desktop/desktop.css'

function readInviteInfo(search: string): { code: string | null; inviter: string | null } {
  const params = new URLSearchParams(search)
  const stored = readStoredReferralCode()
  const rawCode = params.get('ref') || params.get('invite') || stored?.code || null
  const code = rawCode ? rawCode.trim().toUpperCase() : null
  const inviter = params.get('inviter')?.trim() || stored?.inviterNickname?.trim() || null
  return { code: code || null, inviter }
}

function buildShareUrl(pathname: string, search: string, hash: string, code: string | null): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(pathname + search + hash, window.location.origin)
  url.searchParams.delete('__review')
  if (code && !url.searchParams.has('ref') && !url.searchParams.has('invite')) {
    url.searchParams.set('ref', code)
  }
  return url.toString()
}

function MobileNoticeScreen() {
  const location = useLocation()
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [bgFailed, setBgFailed] = useState(false)
  const headingId = useId()
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    document.body.dataset.mobileNotice = 'true'
    return () => {
      delete document.body.dataset.mobileNotice
    }
  }, [])

  const timeBand = useMemo(() => resolveTimeBand('auto'), [])
  const palette = TIME_OF_DAY_PALETTES[timeBand]
  const staticWallpaperUrl = STATIC_FALLBACK_WALLPAPERS[timeBand]

  const { code, inviter } = useMemo(() => readInviteInfo(location.search), [location.search])
  const shareUrl = useMemo(
    () => buildShareUrl(location.pathname, location.search, location.hash, code),
    [location.pathname, location.search, location.hash, code],
  )

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
      setStatusMessage('링크를 복사했어요.')
    } catch {
      setStatusMessage('링크를 복사하지 못했어요. 주소창에서 직접 복사해 주세요.')
    }
  }

  async function sendToPc() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'CAPSULE',
          text: '캡슐은 PC에서 만날 수 있어요',
          url: shareUrl,
        })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyLink()
  }

  return (
    <div
      className="mobile-notice-root"
      data-mobile-notice="scr-40"
      style={{
        background: `radial-gradient(ellipse 75% 58% at 50% 62%, ${palette.glow}38 0%, transparent 72%), linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 52%, ${palette.bottom} 100%)`,
      }}
    >
      {staticWallpaperUrl && (
        <img
          src={staticWallpaperUrl}
          alt=""
          aria-hidden="true"
          className="mobile-notice-wallpaper"
          draggable={false}
        />
      )}

      <main id="main-content" tabIndex={-1} className="mobile-notice-main focus:outline-none">
        <section
          className="desktop-window desktop-window--active mobile-notice-window"
          aria-labelledby={headingId}
        >
          <header className="desktop-window-titlebar mate-window-titlebar-static">
            <div className="desktop-window-title-left">CAPSULE</div>
            <div className="desktop-window-title-right">
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </header>

          <div className="mobile-notice-body">
            <p className="mobile-notice-brand">CAPSULE</p>

            <div className="mobile-notice-avatar" style={{ background: CALL_STAGE_GRADIENT }}>
              {!bgFailed && (
                <img
                  src={chaerinArtwork.callBackground.portrait}
                  alt=""
                  aria-hidden="true"
                  className="mobile-notice-avatar-bg"
                  draggable={false}
                  onError={() => setBgFailed(true)}
                />
              )}
              <img
                src={chaerinArtwork.avatar}
                alt="채린"
                className="mobile-notice-avatar-img"
                draggable={false}
              />
            </div>

            <h1 id={headingId} className="mobile-notice-title">
              캡슐은 PC에서 만날 수 있어요
            </h1>
            <p className="mobile-notice-desc">
              노트북 앞에서 함께하는 서비스라 지금은 PC에서만 열려요. 링크를 복사해 PC 브라우저에서 열어 주세요.
            </p>

            {code && (
              <div className="mobile-notice-invite">
                <p className="mobile-notice-invite-code">
                  {inviter ? `${inviter}님이 초대했어요 · 코드 ${code}` : `초대 코드 · ${code}`}
                </p>
                <p className="mobile-notice-invite-sub">PC에서 가입하고 첫 연결을 마치면 둘 다 1,000 크레딧</p>
              </div>
            )}

            <div className="mobile-notice-actions">
              <Button className="w-full" onClick={() => { void copyLink() }}>
                링크 복사하기
              </Button>
              {canNativeShare && (
                <Button variant="secondary" className="w-full" onClick={() => { void sendToPc() }}>
                  PC로 링크 보내기
                </Button>
              )}
            </div>

            {statusMessage && (
              <p role="status" className="mobile-notice-status">
                {statusMessage}
              </p>
            )}

            <nav aria-label="약관 안내" className="mobile-notice-legal">
              <button type="button" onClick={() => setLegalDoc('terms')}>
                이용약관
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => setLegalDoc('privacy')}>
                개인정보 처리방침
              </button>
            </nav>
          </div>
        </section>
      </main>

      <Dialog
        open={legalDoc !== null}
        onClose={() => setLegalDoc(null)}
        title={legalDoc ? legalDocuments[legalDoc].title : ''}
        className="mobile-notice-legal-dialog"
      >
        {legalDoc && <LegalDocumentBody document={legalDoc} />}
      </Dialog>
    </div>
  )
}

export function MobileAccessGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [phone, setPhone] = useState(() => isPhoneDevice())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(pointer: coarse) and (hover: none)')
    const update = () => setPhone(isPhoneDevice())
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const forced = isReviewMobileNoticeForced()
  if (forced || (phone && !isMobileGateAllowedPath(location.pathname))) {
    return <MobileNoticeScreen />
  }

  return <>{children}</>
}
