import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { Brand } from '@/shared/ui/Brand'
import { Button } from '@/shared/ui/Button'
import { PixelImage } from '@/shared/ui/pixel/PixelFrame'
import { pixelArtSize, pixelArtUrl, type PixelArt } from '@/shared/ui/pixel/pixel-art'
import { AI_NOTICE } from '@/app/components/SiteFooter'
import { chaerinArtwork } from '@/features/mates/artwork'
import { ALIVING_MODEL_SIZE, CHAERIN_V2_LANDMARKS } from '@/features/mate-render/aliving-view'
import { DOZE_FRAMING, computeDozeScene, type DozeCamera, type DozeSceneLayout } from '@/features/auth/login-variants/doze/doze-view'
import { DozeDesk } from '@/features/auth/login-variants/doze/DozeDesk'
import dozeStillUrl from '@/assets/characters/chaerin-v2/chaerin-v2-doze.webp'
import '@/features/auth/login-variants/doze/doze.css'
import './mobile-gate.css'

/**
 * Mobile access screen drafts (2026-11-27, review catalog only: `mobile-gate-m1|m2`). The screen most people see when
 * they open a KakaoTalk link on a phone; today's MobileAccessGate (one pixel modal card) reads as a popup.
 * Both drafts put the login screen's 「노트북 앞에서 조는 채린」 scene up front, tall: the same still, desk and laptop
 * (DozeDesk, doze-view geometry) and the same z z Z and nod, framed for a portrait phone.
 * - M1 「포스터」: the scene fills the top two thirds; words and buttons below, like a continuation of the login screen.
 * - M2 「스크롤 소개」: the first screen is exactly one phone screen (the scene takes what the words leave); scrolling shows three
 *   feature cards (call, voice, records · worlds) with pixel points, then the buttons once more.
 * Nothing here is used by the product (MobileAccessGate is untouched). URL: `?mg-invite=1` shows the invite state,
 * `mg-bar=0` hides the review bar (screenshots). Legal links stay inert here (the real dialog asks the server).
 */

export type MobileGateVariant = 'm1' | 'm2'

const VARIANT_NAME: Record<MobileGateVariant, string> = { m1: 'M1 포스터', m2: 'M2 스크롤 소개' }
/** Review fixture of an invite link (same code as the `mobile-notice` scenario). */
const INVITE_FIXTURE = { code: 'CAP-7K2Q', inviter: '민수' }

const COPY = {
  headline: '나만의 메이트가 기다리고 있어요',
  intro: '영상통화처럼 곁에 있는 메이트와 목소리로 이야기하고, 함께한 시간을 기록해요.',
  pcOnly: '캡슐은 PC에서 열려요. 링크를 PC로 보내 두세요.',
  share: 'PC로 링크 보내기',
  copy: '링크 복사',
} as const

/* ── Pixel pictures (drafts only; same 2 px grid and palette family as shared/ui/pixel/pixel-art.ts) ─────────── */

const PX_CALL: PixelArt = {
  rows: [
    '.aaaaaaaaaa...',
    'abbbbbbbbbba..',
    'abbbbccbbbba..',
    'abbbcddcbbbaa.',
    'abbbcddcbbbaaa',
    'abbbbccbbbbaaa',
    'abbbceecbbbaaa',
    'abbceeeecbbaa.',
    'abbbbbbbbbba..',
    '.aaaaaaaaaa...',
  ],
  palette: { a: '#807E8D', b: '#292733', c: '#D9D5F1', d: '#FAFAFD', e: '#C4B9F3' },
}
const PX_VOICE: PixelArt = {
  rows: [
    '..aaaaaaaa..',
    '.abbbbbbbba.',
    'abbcbbcbbcba',
    'abbcbccbbcba',
    'abccbccbccba',
    'abbcbccbbcba',
    'abbcbbcbbcba',
    '.abbbbbbbba.',
    '..aaaabaaa..',
    '......aba...',
    '.......aa...',
  ],
  palette: { a: '#A4A3B0', b: '#403E4B', c: '#FAFAFD' },
}
const PX_RECORD: PixelArt = {
  rows: [
    'aaaaaaaaaaaa',
    'abbbbbbbbbba',
    'aaaaaaaaaaaa',
    'acc.dd.cc.ea',
    'a..........a',
    'add.cc.ee.da',
    'a..........a',
    'ace.dd.cc..a',
    'aaaaaaaaaaaa',
  ],
  palette: { a: '#807E8D', b: '#5E5C69', c: '#C4B9F3', d: '#AC95F8', e: '#E6DEFF' },
}

function DraftPixel({ art, scale = 3, className }: { art: PixelArt; scale?: number; className?: string }) {
  return <span className={className ? `mg-px ${className}` : 'mg-px'} style={{ ...pixelArtSize(art, scale), backgroundImage: pixelArtUrl(art) }} aria-hidden="true" />
}

const FEATURES = [
  { art: PX_CALL, title: '영상통화처럼 곁에', body: '노트북 화면 너머에 메이트가 함께 앉아 있어요. 혼자 보내던 시간이 둘이 보내는 시간이 돼요.' },
  { art: PX_VOICE, title: '목소리로 대화', body: '말을 걸면 메이트가 목소리로 대답해요. 채팅으로 이야기해도 좋아요.' },
  { art: PX_RECORD, title: '함께한 시간 · 세계관', body: '함께한 시간이 캡슐로 쌓여 기록돼요. 친해질수록 메이트의 새 세계관이 열려요.' },
] as const

/* ── Scene: the login screen's dozing scene, framed for a portrait box ─────────────────────────────────────── */

/**
 * doze-view.ts `computeDozeCamera` with phone numbers: the desk front sits `deskFront` px above the box's bottom and
 * she may be zoomed in further (`minModelWidth`; a little hair at the sides may leave the frame, never the face).
 */
function phoneDozeCamera(cw: number, ch: number, deskFront: number, minModelWidth: number, headMargin: number): DozeCamera {
  const { headTopY, centerX } = CHAERIN_V2_LANDMARKS
  const { deskTopModelY } = DOZE_FRAMING
  const kHeight = (ch - deskFront - headMargin * ch) / (deskTopModelY - headTopY)
  const k = Math.max(0.0001, Math.min(kHeight, cw / minModelWidth))
  const cy = deskTopModelY - (ch / 2 - deskFront) / k
  return { view: { zoom: (k * ALIVING_MODEL_SIZE) / Math.max(1, Math.min(cw, ch)), cx: centerX, cy }, k }
}

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize(prev => {
      const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight)
      return prev && prev.w === w && prev.h === h ? prev : { w, h }
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

function DozeScene({ deskFront, minModelWidth, headMargin, className }: {
  /** Desk front above the box's bottom: a share of the box height. */
  deskFront: number
  minModelWidth: number
  headMargin: number
  className: string
}) {
  const reduced = useReducedMotion()
  const [ref, size] = useBoxSize<HTMLDivElement>()
  let scene: DozeSceneLayout | null = null
  if (size && size.w > 0 && size.h > 0) {
    scene = computeDozeScene(size.w, size.h, phoneDozeCamera(size.w, size.h, size.h * deskFront, minModelWidth, headMargin))
  }
  const box = (b: { left: number; top: number; width: number; height: number }): CSSProperties =>
    ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })

  return (
    <div ref={ref} className={`mg-scene ${className}`} aria-hidden="true">
      <img src={chaerinArtwork.callBackground.portrait} alt="" className="mg-room" draggable={false} />
      {scene && size && <>
        <i className="doze-face-light" style={{ left: `${scene.face.x}px`, top: `${scene.face.y + 70 * scene.k}px`, width: `${520 * scene.k}px`, height: `${460 * scene.k}px` }} />
        <img
          src={dozeStillUrl}
          alt=""
          className="doze-still mg-still"
          data-visible="true"
          data-nodding={!reduced || undefined}
          draggable={false}
          decoding="async"
          style={box(scene.still)}
        />
        <i className="doze-screen-light" style={{ ...box(scene.still), WebkitMaskImage: `url(${dozeStillUrl})`, maskImage: `url(${dozeStillUrl})` }} />
        <DozeDesk scene={scene} width={size.w} height={size.h} screenOn={false} heatmap={false} />
        <div className="doze-zz" style={{ left: `${scene.zz.x}px`, top: `${scene.zz.y}px`, '--k': scene.k } as CSSProperties}>
          <span>z</span>
          <span>z</span>
          <span>Z</span>
        </div>
      </>}
    </div>
  )
}

/* ── Shared parts ─────────────────────────────────────────────────────────────────────────────────────────── */

type Invite = { code: string; inviter: string | null } | null

function readParams() {
  const params = new URLSearchParams(location.search)
  return { invite: params.get('mg-invite') === '1', bar: params.get('mg-bar') !== '0' }
}

/** The address handed to the PC: this page without the review parameters, with the invite code (MobileAccessGate). */
function shareUrl(invite: Invite) {
  const url = new URL('/', location.origin)
  if (invite) url.searchParams.set('ref', invite.code)
  return url.toString()
}

function useLinkActions(invite: Invite) {
  const [status, setStatus] = useState('')
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl(invite))
      setStatus('링크를 복사했어요.')
    } catch {
      setStatus('링크를 복사하지 못했어요. 주소창에서 직접 복사해 주세요.')
    }
  }
  /** Same as today's 「PC로 링크 보내기」: the share sheet (카카오톡 나에게 보내기 …), else copy. */
  async function sendToPc() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'CAPSULE', text: '캡슐은 PC에서 만날 수 있어요', url: shareUrl(invite) })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyLink()
  }
  return { status, setStatus, copyLink, sendToPc }
}

function InviteCard({ invite }: { invite: NonNullable<Invite> }) {
  return (
    <section className="mg-invite" aria-label="초대 코드">
      <PixelImage name="capsule" scale={2} className="mg-invite-capsule" />
      <p className="mg-invite-title">
        {invite.inviter ? <><strong>{invite.inviter}님</strong>의 초대 코드가 저장됐어요</> : <>초대 코드 <strong>{invite.code}</strong>가 저장됐어요</>}
      </p>
      <p className="mg-invite-reward">
        <PixelImage name="coin" scale={2} />
        <span>PC에서 가입하면 둘 다 <em>1,000 크레딧</em></span>
      </p>
      {invite.inviter && <p className="mg-invite-code">코드 {invite.code}</p>}
    </section>
  )
}

function Actions({ actions }: { actions: ReturnType<typeof useLinkActions> }) {
  return (
    <div className="mg-actions">
      <Button className="w-full" onClick={() => { void actions.sendToPc() }}>{COPY.share}</Button>
      <Button variant="secondary" className="w-full" onClick={() => { void actions.copyLink() }}>{COPY.copy}</Button>
    </div>
  )
}

function Footer({ onLegal }: { onLegal: () => void }) {
  return (
    <footer className="mg-footer">
      <nav aria-label="약관 안내" className="mg-legal">
        <button type="button" onClick={onLegal}>이용약관</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onLegal}>개인정보 처리방침</button>
      </nav>
      <p className="mg-ai-notice">{AI_NOTICE}</p>
    </footer>
  )
}

/* ── Drafts ───────────────────────────────────────────────────────────────────────────────────────────────── */

function PosterDraft({ invite }: { invite: Invite }) {
  const headingId = useId()
  const actions = useLinkActions(invite)
  return (
    <main id="main-content" className="mg-root mg-m1" data-invite={invite ? 'true' : undefined} aria-labelledby={headingId}>
      <DozeScene className="mg-m1-scene" deskFront={0.14} minModelWidth={540} headMargin={0.1} />
      <Brand className="mg-brand" />
      <div className="mg-m1-body">
        <h1 id={headingId} className="mg-headline">{COPY.headline}</h1>
        <p className="mg-intro">{COPY.intro}</p>
        {invite && <InviteCard invite={invite} />}
        <Actions actions={actions} />
        <p className="mg-pc-only">{COPY.pcOnly}</p>
        {actions.status && <p role="status" className="mg-status">{actions.status}</p>}
        <Footer onLegal={() => actions.setStatus('약관 창은 지금 화면과 같아요. 시안에서는 열지 않아요.')} />
      </div>
    </main>
  )
}

function ScrollDraft({ invite }: { invite: Invite }) {
  const headingId = useId()
  const featuresId = useId()
  const actions = useLinkActions(invite)
  return (
    <main id="main-content" className="mg-root mg-m2" data-invite={invite ? 'true' : undefined}>
      <section className="mg-m2-first" aria-labelledby={headingId}>
        <DozeScene className="mg-m2-scene" deskFront={0.12} minModelWidth={560} headMargin={0.08} />
        <Brand className="mg-brand" />
        <div className="mg-m2-hero">
          <h1 id={headingId} className="mg-headline">{COPY.headline}</h1>
          {!invite && <p className="mg-intro">{COPY.intro}</p>}
          {invite && <InviteCard invite={invite} />}
          <Actions actions={actions} />
          {actions.status && <p role="status" className="mg-status">{actions.status}</p>}
        </div>
        <a className="mg-more" href={`#${featuresId}`}>
          <span>캡슐 둘러보기</span>
          <span className="mg-more-arrow" aria-hidden="true" />
        </a>
      </section>

      <section id={featuresId} className="mg-m2-features" aria-labelledby={`${featuresId}-title`}>
        <h2 id={`${featuresId}-title`} className="mg-section-title">노트북 앞, 메이트와 보내는 시간</h2>
        <ul className="mg-cards">
          {FEATURES.map(feature => (
            <li key={feature.title} className="mg-card">
              <DraftPixel art={feature.art} className="mg-card-icon" />
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
        <p className="mg-pc-only">{COPY.pcOnly}</p>
        <Actions actions={actions} />
        <Footer onLegal={() => actions.setStatus('약관 창은 지금 화면과 같아요. 시안에서는 열지 않아요.')} />
      </section>
    </main>
  )
}

export function MobileGatePreview({ variant: initialVariant, invite: initialInvite }: { variant: MobileGateVariant; invite?: boolean }) {
  const [params] = useState(readParams)
  const [variant, setVariant] = useState(initialVariant)
  const [inviteOn, setInviteOn] = useState(Boolean(initialInvite) || params.invite)
  const invite: Invite = inviteOn ? INVITE_FIXTURE : null

  useEffect(() => {
    document.body.dataset.mobileNotice = 'true'
    return () => { delete document.body.dataset.mobileNotice }
  }, [])

  return <>
    {variant === 'm1' ? <PosterDraft invite={invite} /> : <ScrollDraft invite={invite} />}
    {params.bar && (
      <div className="mg-bar" role="group" aria-label="시안 검토 막대">
        <span className="mg-bar-name">모바일 접속 · {VARIANT_NAME[variant]}</span>
        {(['m1', 'm2'] as const).map(id => (
          <button key={id} type="button" aria-pressed={variant === id} onClick={() => setVariant(id)}>{id.toUpperCase()}</button>
        ))}
        <button type="button" aria-pressed={inviteOn} onClick={() => setInviteOn(on => !on)}>초대 링크</button>
      </div>
    )}
  </>
}
