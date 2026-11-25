import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { CREDIT_NOTICE_COPY } from '@/features/mates/credit-notice'
import { MATE_RESET_CLEARS, MATE_RESET_KEEPS } from '@/features/mates/mate-contract'
import { SPRITES, SPRITE_TONES, type SnowKind } from '@/features/mates/pixel-snow/pixel-snow-model'
import faceNeutral from '@/assets/characters/chaerin-v2/expressions/neutral.webp'
import faceHappy from '@/assets/characters/chaerin-v2/expressions/happy.webp'
import faceSulky from '@/assets/characters/chaerin-v2/expressions/sulky.webp'
import faceShy from '@/assets/characters/chaerin-v2/expressions/shy.webp'
import faceFocus from '@/assets/characters/chaerin-v2/expressions/focus.webp'
import faceLaugh from '@/assets/characters/chaerin-v2/expressions/laugh.webp'
import { PIXEL_ART, pixelArtSize, pixelArtUrl, type PixelArtName } from '@/shared/ui/pixel/pixel-art'
import './dialog-design.css'

/**
 * Modal / popup design drafts (2026-11-26, review catalog only: `dialog-design-a|b|c|b2|b3`; B2/B3 push B's pixel
 * look further: B2 「픽셀 프레임」 stepped corners, dithered roof, 8-bit capsule, slow snow, stepped entrance; B3
 * 「픽셀 액센트」 keeps B's round shape with pixels in three places only). Nothing here is used by the
 * product. The modal kinds use the real shared `Dialog` (focus, Esc, backdrop click unchanged) with a style class and
 * decorations around its content; enter is a CSS keyframe on `[open]`, leave is a CSS transition with
 * `display`/`overlay` allow-discrete, so the component API stays as it is. Only transform and opacity move.
 */

export type DialogDesignVariant = 'a' | 'b' | 'c' | 'b2' | 'b3'
type Kind = 'confirm' | 'credit' | 'unlock' | 'toast' | 'large'
type View = Kind | 'all' | 'none'
type Face = 'neutral' | 'happy' | 'sulky' | 'shy' | 'focus' | 'laugh'
type ToastTone = 'success' | 'warning'

const VARIANT_NAME: Record<DialogDesignVariant, string> = { a: '캡슐 유리', b: '밤하늘', c: '메이트와 함께', b2: '픽셀 프레임', b3: '픽셀 액센트' }
const isPixel = (variant: DialogDesignVariant) => variant === 'b2' || variant === 'b3'
/** The surface's variant, for the pieces deep inside the bodies (pixel icons, the B3 button sparkle). */
const VariantContext = createContext<DialogDesignVariant>('a')
const VIEWS: readonly { id: Exclude<View, 'none'>; label: string }[] = [
  { id: 'all', label: '모두 보기' },
  { id: 'confirm', label: '확인' },
  { id: 'credit', label: '안내 · 부족' },
  { id: 'unlock', label: '안내 · 열림' },
  { id: 'toast', label: '토스트' },
  { id: 'large', label: '큰 창' },
]
const FACES: Record<Face, string> = { neutral: faceNeutral, happy: faceHappy, sulky: faceSulky, shy: faceShy, focus: faceFocus, laugh: faceLaugh }
/** The mate's resting face per surface (variant C). The confirm dialog changes it with the button under the pointer. */
const RESTING_FACE: Record<Kind, Face> = { confirm: 'neutral', credit: 'shy', unlock: 'happy', toast: 'laugh', large: 'neutral' }
const TITLE: Record<Kind, string> = {
  confirm: '대화 초기화',
  credit: CREDIT_NOTICE_COPY.title,
  unlock: '세계관이 열렸어요',
  toast: '결과 알림',
  large: '계정 설정',
}
const MATE = '채린'
const LEAVE_MS = 200

function readInitialView(): View {
  const value = new URLSearchParams(location.search).get('dd')
  return VIEWS.some(view => view.id === value) ? value as View : 'all'
}

/* ── Decorations (aria-hidden, pointer-events none) ─────────────────────────────────────────────────────────────── */

const spriteUrls = new Map<string, string>()
/** One SVG data URL per sprite and tone, built once: the browser rasterizes each picture a single time. */
function spriteUrl(kind: SnowKind, tone: number) {
  const key = `${kind}:${tone}`
  const cached = spriteUrls.get(key)
  if (cached) return cached
  const rows = SPRITES[kind]
  const colors = SPRITE_TONES[kind][tone] ?? SPRITE_TONES[kind][0]!
  const rects = rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '.' ? [] : [`<rect x='${x}' y='${y}' width='1' height='1' fill='${cell === 'a' ? colors.a : cell === 'b' ? colors.b : '#FFFFFF'}'/>`]))
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${rows[0]!.length} ${rows.length}' shape-rendering='crispEdges'>${rects.join('')}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  spriteUrls.set(key, url)
  return url
}

function PixelSprite({ kind, tone = 0, className, style }: { kind: SnowKind; tone?: number; className?: string; style?: CSSProperties }) {
  const rows = SPRITES[kind]
  return <span
    className={cn('dd-pixel', className)}
    style={{ width: rows[0]!.length * 2, height: rows.length * 2, backgroundImage: spriteUrl(kind, tone), ...style }}
    aria-hidden="true"
  />
}

function Pixel({ name, scale = 2, className, style }: { name: PixelArtName; scale?: number; className?: string; style?: CSSProperties }) {
  const art = PIXEL_ART[name]
  return <span className={cn('dd-pixel', className)} style={{ ...pixelArtSize(art, scale), backgroundImage: pixelArtUrl(art), ...style }} aria-hidden="true" />
}

/** B2 snow inside the roof: x in %, top in px, fall duration in s, start offset in s (negative = already falling). */
const ROOF_SNOW: readonly { kind: SnowKind; x: number; top: number; s: number; at: number; tone: number }[] = [
  { kind: 'dot', x: 14, top: 10, s: 11, at: -2, tone: 0 },
  { kind: 'flake', x: 30, top: 24, s: 14, at: -9, tone: 1 },
  { kind: 'dot', x: 68, top: 6, s: 12, at: -6, tone: 1 },
  { kind: 'flake', x: 82, top: 30, s: 15, at: -3, tone: 0 },
  { kind: 'dot', x: 92, top: 16, s: 10, at: -7, tone: 0 },
]

function PixelRoof({ compact = false }: { compact?: boolean }) {
  return <span className="dd-px-roof" aria-hidden="true">
    <span className="dd-px-dither dd-px-dither--50" />
    <span className="dd-px-dither dd-px-dither--25" />
    <span className="dd-px-dither dd-px-dither--12" />
    {(compact ? ROOF_SNOW.slice(1) : ROOF_SNOW).map((flake, index) => <PixelSprite
      key={index}
      kind={flake.kind}
      tone={flake.tone}
      className="dd-px-snow"
      style={{ left: `${flake.x}%`, top: flake.top, '--dd-fall': `${flake.s}s`, '--dd-at': `${flake.at}s` } as CSSProperties}
    />)}
  </span>
}

/**
 * Fixed star field for variant B: x/y in % of the band above the heading (76px), kept right of the icon badge so no
 * sprite sits on a word. d = delay step.
 */
const STARS: readonly { kind: SnowKind; x: number; y: number; tone: number; twinkle?: boolean; d: number }[] = [
  { kind: 'dot', x: 27, y: 34, tone: 0, d: 0 },
  { kind: 'flake', x: 39, y: 58, tone: 1, twinkle: true, d: 2 },
  { kind: 'dot', x: 48, y: 16, tone: 1, d: 1 },
  { kind: 'capsule', x: 60, y: 40, tone: 0, d: 4 },
  { kind: 'dot', x: 71, y: 14, tone: 0, twinkle: true, d: 3 },
  { kind: 'flake', x: 81, y: 50, tone: 0, d: 5 },
  { kind: 'dot', x: 89, y: 22, tone: 1, d: 2 },
  { kind: 'dot', x: 94, y: 64, tone: 0, twinkle: true, d: 4 },
]

function Decor({ variant, face, compact = false }: { variant: DialogDesignVariant; face: Face; compact?: boolean }) {
  if (variant === 'a') return <>
    <span className="dd-a-spill" aria-hidden="true" />
    <span className="dd-a-sheen" aria-hidden="true" />
    {!compact && <span className="dd-a-capsule" aria-hidden="true">
      <span className="dd-a-half dd-a-half--l" />
      <span className="dd-a-half dd-a-half--r" />
      <span className="dd-a-seam" />
    </span>}
  </>
  if (variant === 'b2') return <>
    <PixelRoof compact={compact} />
    <Pixel name="capsule" className="dd-px-capsule" />
  </>
  if (variant === 'b3') return <span className="dd-b3-head" aria-hidden="true" />
  if (variant === 'b') return <>
    <span className="dd-b-glow" aria-hidden="true" />
    <span className="dd-b-sky" aria-hidden="true">
      {(compact ? STARS.slice(0, 5) : STARS).map((star, index) => <PixelSprite
        key={index}
        kind={star.kind}
        tone={star.tone}
        className={cn('dd-b-star', star.twinkle && 'dd-b-star--twinkle')}
        style={{ left: `${star.x}%`, top: `${star.y}%`, '--dd-d': star.d } as CSSProperties}
      />)}
    </span>
    <span className="dd-b-edge" aria-hidden="true"><span className="dd-b-flow" /></span>
  </>
  return <>
    <span className="dd-c-peek" aria-hidden="true">
      {(Object.keys(FACES) as Face[]).map(name => <img key={name} src={FACES[name]} alt="" draggable={false} data-on={name === face || undefined} />)}
    </span>
    <span className="dd-c-tail" aria-hidden="true" />
  </>
}

/* ── Surface contents ────────────────────────────────────────────────────────────────────────────────────────── */

const PIXEL_ICON: Partial<Record<IconName, PixelArtName>> = { warning: 'warning', coin: 'coin', sparkle: 'star' }

function Heading({ icon, tone, eyebrow, children }: { icon: IconName; tone: 'danger' | 'warning' | 'accent'; eyebrow?: string; children: ReactNode }) {
  const variant = useContext(VariantContext)
  const pixel = isPixel(variant) ? PIXEL_ICON[icon] : undefined
  return <div className="dd-heading">
    <span className="dd-badge" data-tone={tone}>{pixel ? <Pixel name={pixel} /> : <Icon name={icon} size={20} />}</span>
    {eyebrow && <p className="dd-eyebrow">{eyebrow}</p>}
    <h2 className="dd-title">{children}</h2>
    {variant === 'b3' && <Constellation />}
  </div>
}

/** B3: one row of dotted pixel stars under the heading (the only divider of the head). */
function Constellation({ head = false }: { head?: boolean }) {
  return <span className={cn('dd-b3-stars', head && 'dd-b3-stars--head')} style={{ backgroundImage: pixelArtUrl(PIXEL_ART.constellation) }} aria-hidden="true" />
}

/** B3: pixel sparkles around the main button, shown on hover / keyboard focus only. */
function Sparkle() {
  return useContext(VariantContext) === 'b3' ? <span className="dd-b3-spark" aria-hidden="true">
    <Pixel name="spark" className="dd-b3-spark-a" />
    <Pixel name="spark" className="dd-b3-spark-b" />
    <Pixel name="spark" scale={1} className="dd-b3-spark-c" />
  </span> : null
}

function ConfirmBody({ onClose, onFace }: { onClose: () => void; onFace: (face: Face | null) => void }) {
  // Pointer over a button, or Tab arriving on it (keyup lands on the newly focused button). The initial focus on 취소
  // does not count, so the mate starts with the resting face.
  const hold = (face: Face) => ({
    onPointerEnter: () => onFace(face),
    onPointerLeave: () => onFace(null),
    onKeyUp: (event: { key: string }) => { if (event.key === 'Tab') onFace(face) },
    onBlur: () => onFace(null),
  })
  return <>
    <Heading icon="warning" tone="danger">{MATE}과의 대화를 초기화할까요?</Heading>
    <dl className="dd-scope">
      <div><dt>지워지는 것</dt><dd>{MATE_RESET_CLEARS.join(', ')}</dd></div>
      <div><dt>그대로 남는 것</dt><dd>{MATE_RESET_KEEPS.join(', ')}</dd></div>
    </dl>
    <p className="dd-warn-line">초기화한 대화는 되돌릴 수 없어요.</p>
    <div className="dd-actions">
      <Button variant="secondary" data-dialog-initial-focus onClick={onClose} {...hold('happy')}>취소</Button>
      <Button variant="danger-solid" onClick={onClose} {...hold('sulky')}>초기화하기</Button>
    </div>
  </>
}

function CreditBody({ onClose }: { onClose: () => void }) {
  const pixel = isPixel(useContext(VariantContext))
  return <>
    <Heading icon="coin" tone="warning">{CREDIT_NOTICE_COPY.title}</Heading>
    <p className="dd-text">{CREDIT_NOTICE_COPY.body}</p>
    <p className="dd-chip">{pixel ? <Pixel name="coin" scale={1} /> : <Icon name="coin" size={16} />}{CREDIT_NOTICE_COPY.remaining(20)}</p>
    <div className="dd-actions">
      <Button variant="secondary" onClick={onClose}>{CREDIT_NOTICE_COPY.invite}</Button>
      <Button variant="primary" data-dialog-initial-focus onClick={onClose}>{CREDIT_NOTICE_COPY.basic}<Sparkle /></Button>
    </div>
  </>
}

function UnlockBody({ onClose }: { onClose: () => void }) {
  const pixel = isPixel(useContext(VariantContext))
  // B2/B3 use the revised copy (2026-11-26): a 세계관 is a place, background and outfit set, named by episode.
  if (pixel) return <>
    <Heading icon="sparkle" tone="accent">새 세계관이 열렸어요 <span className="dd-ep">· EP.03 도서관</span></Heading>
    <p className="dd-text">{MATE}과 도서관에서 만날 수 있어요.</p>
    <div className="dd-actions">
      <Button variant="ghost" onClick={onClose}>나중에</Button>
      <Button variant="primary" data-dialog-initial-focus onClick={onClose}>보러 가기<Sparkle /></Button>
    </div>
  </>
  return <>
    <Heading icon="sparkle" tone="accent" eyebrow="새로 열렸어요">{MATE}의 세계관이 열렸어요</Heading>
    <p className="dd-text">메이트 상세에서 {MATE}가 지내는 곳과 지금까지의 이야기를 볼 수 있어요.</p>
    <div className="dd-actions">
      <Button variant="ghost" onClick={onClose}>나중에</Button>
      <Button variant="primary" data-dialog-initial-focus onClick={onClose}>보러 가기</Button>
    </div>
  </>
}

const LARGE_TABS = ['프로필', '설정', '보안'] as const

function LargeBody({ variant, face, onClose }: { variant: DialogDesignVariant; face: Face; onClose: () => void }) {
  return <>
    <header className="dd-large-head">
      <Decor variant={variant} face={face} compact />
      {variant === 'a' && <span className="dd-a-mini" aria-hidden="true"><span className="dd-a-half dd-a-half--l" /><span className="dd-a-half dd-a-half--r" /><span className="dd-a-seam" /></span>}
      {variant === 'b3' && <Pixel name="capsule" className="dd-b3-mini" />}
      <h2 className="dd-large-title">계정 설정</h2>
      <button type="button" className="dd-close" aria-label="닫기" onClick={onClose}><Icon name="close" size={20} /></button>
      {variant === 'b3' && <Constellation head />}
    </header>
    <div className="dd-large-body">
      <nav className="dd-large-nav" aria-label="계정 설정 메뉴(시안)">
        {LARGE_TABS.map((tab, index) => <span key={tab} className="dd-large-tab" data-selected={index === 0 || undefined}>{tab}</span>)}
      </nav>
      <div className="dd-large-content">
        <p className="dd-large-label">닉네임</p>
        <div className="dd-large-field">문구 검토</div>
        <p className="dd-large-label">나에 대해</p>
        <div className="dd-large-field dd-large-field--tall">메이트가 알아 두면 좋을 이야기를 적어 주세요.</div>
        <p className="dd-large-note">큰 창은 테두리 없는 표면과 머리 장식만 맞춰요. 안쪽 배치는 지금 계정 설정을 따릅니다.</p>
      </div>
    </div>
  </>
}

/* ── One surface: a real modal Dialog, or a still copy for the gallery ───────────────────────────────────────── */

function DesignSurface({ variant, kind, mode, open = false, onClose }: {
  variant: DialogDesignVariant
  kind: Exclude<Kind, 'toast'>
  mode: 'modal' | 'static'
  open?: boolean
  onClose: () => void
}) {
  const [hover, setHover] = useState<Face | null>(null)
  const face = hover ?? RESTING_FACE[kind]
  const body = kind === 'large'
    ? <LargeBody variant={variant} face={face} onClose={onClose} />
    : <>
      <Decor variant={variant} face={face} />
      <div className="dd-scroll">
        {kind === 'confirm' && <ConfirmBody onClose={onClose} onFace={setHover} />}
        {kind === 'credit' && <CreditBody onClose={onClose} />}
        {kind === 'unlock' && <UnlockBody onClose={onClose} />}
      </div>
    </>
  const inner = <VariantContext value={variant}>
    {variant === 'b2' && <span className="dd-px-shade" aria-hidden="true" />}
    <span className="dd-bg" aria-hidden="true" />
    {body}
  </VariantContext>
  const className = cn('dd-surface', `dd-v-${variant}`, `dd-k-${kind}`)
  if (mode === 'static') return <section className={cn(className, 'dd-static')} aria-label={`${TITLE[kind]} 미리보기`} inert>{inner}</section>
  return <Dialog
    open={open}
    onClose={onClose}
    title={TITLE[kind]}
    showHeader={false}
    className={cn(className, 'dd-dialog overflow-visible bg-transparent p-0 sm:p-0', kind === 'large' ? 'max-w-[880px]' : 'max-w-[440px]')}
  >{inner}</Dialog>
}

/* ── Toasts ──────────────────────────────────────────────────────────────────────────────────────────────────── */

type ToastItem = { id: number; tone: ToastTone; leaving?: boolean }
const TOAST_COPY: Record<ToastTone, { title: string; text: string; icon: IconName; face: Face }> = {
  success: { title: '초대 링크를 복사했어요', text: '친구에게 바로 붙여 넣어 보낼 수 있어요.', icon: 'check', face: 'laugh' },
  warning: { title: '카메라를 찾지 못했어요', text: '카메라 없이도 연결은 그대로 이어져요.', icon: 'warning', face: 'focus' },
}

function DesignToast({ variant, item, onDismiss, still = false }: { variant: DialogDesignVariant; item: ToastItem; onDismiss?: (id: number) => void; still?: boolean }) {
  const copy = TOAST_COPY[item.tone]
  return <div
    role={still ? undefined : item.tone === 'warning' ? 'alert' : 'status'}
    aria-atomic={still ? undefined : true}
    className={cn('dd-toast', `dd-v-${variant}`, still && 'dd-static')}
    data-tone={item.tone}
    data-leaving={item.leaving || undefined}
  >
    <span className="dd-bg" aria-hidden="true" />
    {variant === 'b' && <span className="dd-b-sky" aria-hidden="true">
      <PixelSprite kind="dot" className="dd-b-star dd-b-star--twinkle" style={{ left: '72%', top: '6%', '--dd-d': 1 } as CSSProperties} />
      <PixelSprite kind="dot" tone={1} className="dd-b-star" style={{ left: '84%', top: '76%', '--dd-d': 3 } as CSSProperties} />
    </span>}
    {variant === 'a' && <span className="dd-a-sheen" aria-hidden="true" />}
    {variant === 'b2' && <span className="dd-px-shade" aria-hidden="true" />}
    {isPixel(variant)
      ? <span className="dd-toast-icon" aria-hidden="true"><Pixel name={item.tone === 'warning' ? 'warningStatus' : 'check'} /></span>
      : variant === 'c'
      ? <span className="dd-toast-face" aria-hidden="true"><img src={FACES[copy.face]} alt="" draggable={false} /><span className="dd-toast-face-badge"><Icon name={copy.icon} size={12} /></span></span>
      : <span className="dd-toast-icon" aria-hidden="true"><Icon name={copy.icon} size={18} /></span>}
    <div className="dd-toast-content">
      <p className="dd-toast-title">{copy.title}</p>
      <p className="dd-toast-text">{copy.text}</p>
    </div>
    <button type="button" className="dd-toast-close" aria-label={`${copy.title} 알림 닫기`} onClick={() => onDismiss?.(item.id)} tabIndex={still ? -1 : undefined}>
      <Icon name="close" size={16} />
    </button>
  </div>
}

function useToasts(reduced: boolean) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<number[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => {
    if (reduced) { setItems(list => list.filter(item => item.id !== id)); return }
    setItems(list => list.map(item => item.id === id ? { ...item, leaving: true } : item))
    timers.current.push(window.setTimeout(() => setItems(list => list.filter(item => item.id !== id)), LEAVE_MS))
  }, [reduced])
  const show = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = []
    setItems([])
    const push = (tone: ToastTone, delay: number) => timers.current.push(window.setTimeout(() => {
      const id = ++seq.current
      setItems(list => [...list, { id, tone }])
      // Leaves by itself like the product notifications, so the exit can be reviewed too.
      timers.current.push(window.setTimeout(() => dismiss(id), 7000))
    }, delay))
    push('success', 60); push('warning', 460)
  }, [dismiss])
  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; setItems([]) }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return { items, show, clear, dismiss }
}

/* ── Gallery: all four kinds at once, as still copies that play their entrance ───────────────────────────────── */

function Gallery({ variant, onOpen }: { variant: DialogDesignVariant; onOpen: (kind: Kind) => void }) {
  const caption = (kind: Kind, label: string) => <div className="dd-gallery-caption">
    <span>{label}</span>
    <button type="button" onClick={() => onOpen(kind)}>실제로 열기</button>
  </div>
  return <div className="dd-gallery" data-variant={variant}>
    <div className="dd-gallery-cell">{caption('confirm', '확인 대화상자')}<DesignSurface variant={variant} kind="confirm" mode="static" onClose={() => {}} /></div>
    <div className="dd-gallery-cell">{caption('credit', '안내 팝업 · 크레딧 부족')}<DesignSurface variant={variant} kind="credit" mode="static" onClose={() => {}} /></div>
    <div className="dd-gallery-cell">{caption('unlock', '안내 팝업 · 세계관 열림')}<DesignSurface variant={variant} kind="unlock" mode="static" onClose={() => {}} /></div>
    <div className="dd-gallery-cell dd-gallery-cell--large">{caption('large', '큰 창 머리 장식')}<div className="dd-gallery-crop"><DesignSurface variant={variant} kind="large" mode="static" onClose={() => {}} /></div></div>
    <div className="dd-gallery-cell dd-gallery-cell--toast">{caption('toast', '결과 알림 (토스트)')}
      <div className="dd-gallery-toasts">
        <DesignToast variant={variant} item={{ id: -1, tone: 'success' }} still />
        <DesignToast variant={variant} item={{ id: -2, tone: 'warning' }} still />
      </div>
    </div>
  </div>
}

/* ── Stage ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export function DialogDesignPreview({ variant }: { variant: DialogDesignVariant }) {
  const reduced = useReducedMotion()
  const [view, setView] = useState<View>(readInitialView)
  const [run, setRun] = useState(0)
  const toasts = useToasts(reduced)
  const { show: showToasts, clear: clearToasts } = toasts
  const reopen = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (view === 'toast') showToasts()
    else clearToasts()
  }, [view, run, showToasts, clearToasts])
  useEffect(() => () => window.clearTimeout(reopen.current), [])

  const select = (next: Exclude<View, 'none'>) => {
    window.clearTimeout(reopen.current)
    if (next !== view) { setView(next); return }
    // Same view again = replay: let the leave transition run, then open again.
    if (next === 'all' || next === 'toast') { setRun(value => value + 1); return }
    setView('none')
    reopen.current = window.setTimeout(() => setView(next), reduced ? 0 : LEAVE_MS + 60)
  }
  const close = () => setView('none')

  return createPortal(<div className="dd-root" data-dialog-design={variant}>
    {view === 'all' && <Gallery key={run} variant={variant} onOpen={kind => setView(kind)} />}
    {(['confirm', 'credit', 'unlock', 'large'] as const).map(kind => <DesignSurface key={kind} variant={variant} kind={kind} mode="modal" open={view === kind} onClose={close} />)}
    <div className="dd-toast-stack" aria-label="알림" role="region">
      {toasts.items.map(item => <DesignToast key={item.id} variant={variant} item={item} onDismiss={toasts.dismiss} />)}
    </div>
    <nav className="dd-bar" aria-label="모달 시안 전환">
      <span className="dd-bar-name">시안 {variant.toUpperCase()} · {VARIANT_NAME[variant]}</span>
      <span className="dd-bar-tabs">
        {VIEWS.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => select(item.id)}>{item.label}</button>)}
      </span>
      <button type="button" className="dd-bar-replay" onClick={() => select(view === 'none' ? 'all' : view)}>다시 재생</button>
    </nav>
  </div>, document.body)
}
