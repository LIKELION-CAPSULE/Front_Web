import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { ShowcasePointer, type CursorConfig, type CursorStep, type CursorTarget } from '@/shared/ui/showcase-pointer/showcase-pointer'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { mateAvatar } from '@/features/mates/artwork'
import { resolveMateFeatures } from '@/features/mates/mate-features'
import { Button } from '@/shared/ui/Button'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { SCREEN_LABELS, TOUR_ORIGIN_KEY, readMs, tourHref, tourSteps, type TourStep } from './tour-steps'
import './service-tour.css'

/**
 * The service tour controller (`?tour=<step>` on any screen; App mounts it). One cursor, 「채린」 (Showcase Pointer),
 * walks the whole service; see tour-steps.ts for the script.
 *
 * - Screens change only when the user presses 「다음」/「이전」 (the controller navigates); inside one screen a step moves
 *   on by itself once its line has been read. The cursor's click is a visual press: `onCursorPress` changes local
 *   preview state only, nothing is clicked, submitted, played or navigated.
 * - The address keeps the step, so a reload resumes it. 「건너뛰기」 (or Esc) returns to the screen the tour started from.
 * - After arriving, the controller waits for the step's target (lazy screens, the my-mates pour, the records board);
 *   a target that does not show up in time is skipped in the direction of travel.
 * - While it runs the app is inert and does not scroll; the tour layer is a manual popover (top layer). When the account
 *   settings dialog (a native modal) is open, the layer moves inside it so it stays above it and usable, and the
 *   dialog's own content is made inert instead.
 * - Reduced motion: no cursor or movement; the target is lit and 채린's line sits beside it, paced by 「다음」.
 */

type Spot = { left: number; top: number; width: number; height: number }
const PAD = 8
const CHAERIN_COLOR = '#8053F2'
const DEFAULT_WAIT_MS = 4000

function spotOf(element: Element | null): Spot | null {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
}

function findTarget(step: TourStep): Element | null {
  for (const selector of step.targets) {
    const element = document.querySelector(selector)
    if (element && element.getClientRects().length) return element
  }
  return null
}

/** Is the app already showing the step's screen? */
function onScreen(step: TourStep, pathname: string, search: URLSearchParams, mateId: string): boolean {
  switch (step.screen) {
    case 'home':
    case 'outro':
      return pathname === '/' && !search.get('account')
    case 'mate-detail':
      return pathname === `/mates/${mateId}`
    case 'call':
      return pathname === `/tour/call/${mateId}`
    case 'my-mates':
      return pathname === '/mates/me'
    case 'records':
      return pathname === '/records'
    case 'account':
      return pathname === '/' && search.get('account') === (step.id === 'account-profile' ? 'profile' : 'settings')
  }
}

export default function ServiceTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const { home } = useBackend()
  const reduced = useReducedMotion()
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])
  const mateId = availableMates(home)[0]?.id ?? ''
  const featureOverride = search.get('features')
  const context = useMemo(() => {
    const features = resolveMateFeatures(import.meta.env.DEV, featureOverride)
    return { mateId, features: { affinity: features.affinity, expressions: features.expressions } }
  }, [mateId, featureOverride])
  const steps = useMemo(() => tourSteps(context), [context])
  const stepId = search.get('tour')
  const found = steps.findIndex((value) => value.id === stepId)
  const index = Math.max(0, found)
  const step = steps[index]!
  // The direction of travel rides along in the history state: screens remount the tour, and a missing target is
  // skipped the same way the user was going.
  const way: 1 | -1 = (location.state as { tourWay?: 1 | -1 } | null)?.tourWay === -1 ? -1 : 1
  const [target, setTarget] = useState<{ id: string; element: Element | null } | null>(null)
  const element = target?.id === step.id ? target.element : null
  const [spot, setSpot] = useState<Spot | null>(null)
  const [lineBottom, setLineBottom] = useState<{ left: number; top: number } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [host, setHost] = useState<HTMLElement>(() => document.body)
  const atScreen = mateId !== '' && onScreen(step, location.pathname, search, mateId)
  /** On its screen with its target found (a step without a target, the outro, is ready on arrival). */
  const ready = atScreen && (step.targets.length === 0 || target?.id === step.id)
  const next = steps[index + 1]
  const previous = steps[index - 1]

  const go = useCallback((to: TourStep, toWay: 1 | -1) => {
    setPreview(null)
    navigate(tourHref(to, context), { replace: true, state: { tourWay: toWay } })
  }, [navigate, context])

  const finish = useCallback((to: string) => {
    try { sessionStorage.removeItem(TOUR_ORIGIN_KEY) } catch { /* Nothing kept. */ }
    navigate(to, { replace: true })
  }, [navigate])

  const skip = useCallback(() => {
    let origin = '/'
    try { origin = sessionStorage.getItem(TOUR_ORIGIN_KEY) || '/' } catch { /* Home. */ }
    finish(origin)
    // Back on home: focus returns to 「사용법 보기」.
    window.setTimeout(() => document.querySelector<HTMLElement>('.mate-tutorial-trigger')?.focus({ preventScroll: true }), 200)
  }, [finish])

  const meetMates = useCallback(() => {
    finish('/')
    window.setTimeout(() => {
      const heading = document.getElementById('mates-heading')
      heading?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
      heading?.focus({ preventScroll: true })
    }, 200)
  }, [finish, reduced])

  // An unknown step (old link) starts over; a step whose screen is not showing moves there.
  useEffect(() => {
    if (!mateId) return
    if (found < 0 || !atScreen) navigate(tourHref(step, context), { replace: true, state: { tourWay: way } })
  }, [found, atScreen, step, context, navigate, mateId, way])

  // Wait for the target on its screen; skip the step (in the direction of travel) when it does not show up.
  useEffect(() => {
    if (!atScreen || !step.targets.length) return
    const started = performance.now()
    let timer = 0
    const poll = () => {
      const element = findTarget(step)
      if (element) { setTarget({ id: step.id, element }); return }
      if (performance.now() - started > (step.waitMs ?? DEFAULT_WAIT_MS)) {
        const skipTo = steps[index + way] ?? (way > 0 ? steps.at(-1) : steps[0])
        if (skipTo && skipTo.id !== step.id) go(skipTo, way)
        return
      }
      timer = window.setTimeout(poll, 120)
    }
    poll()
    return () => window.clearTimeout(timer)
  }, [atScreen, step, steps, index, go, way])

  // Reduced motion: bring the target into view at once (the cursor script scrolls smoothly otherwise).
  useEffect(() => {
    if (reduced && element) element.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [reduced, element])

  // Spotlight, the press preview under 채린's line, and the layer's host (the account dialog when it is open).
  useEffect(() => {
    let frame = 0
    const follow = () => {
      const nextSpot = spotOf(element)
      setSpot((old) => (old && nextSpot && Math.abs(old.left - nextSpot.left) < 0.5 && Math.abs(old.top - nextSpot.top) < 0.5 && Math.abs(old.width - nextSpot.width) < 0.5 && Math.abs(old.height - nextSpot.height) < 0.5 ? old : nextSpot))
      const label = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
      const below = label ? { left: Math.round(label.left), top: Math.round(label.bottom + 8) } : null
      setLineBottom((old) => (old?.left === below?.left && old?.top === below?.top ? old : below))
      const dialog = document.querySelector<HTMLElement>('dialog[open]')
      setHost((old) => { const nextHost = dialog ?? document.body; return old === nextHost ? old : nextHost })
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [element])

  // The layer: a manual popover so it sits in the top layer (above a modal dialog when it lives inside it).
  const layer = useMemo(() => {
    const div = document.createElement('div')
    div.className = 'service-tour-layer'
    div.setAttribute('popover', 'manual')
    return div
  }, [host]) // eslint-disable-line react-hooks/exhaustive-deps -- a new layer for each host
  useLayoutEffect(() => {
    host.append(layer)
    try { layer.showPopover() } catch { /* No popover support: a fixed layer still covers the page. */ }
    // The app (or, inside the dialog, the dialog's own content) is inert; the page does not scroll.
    const blocked: Element[] = host === document.body ? [document.getElementById('root')].filter((value): value is HTMLElement => Boolean(value)) : [...host.children].filter((child) => child !== layer)
    for (const node of blocked) node.setAttribute('inert', '')
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      for (const node of blocked) node.removeAttribute('inert')
      html.style.overflow = overflow
      try { layer.hidePopover() } catch { /* Already hidden. */ }
      layer.remove()
    }
  }, [host, layer])

  // Esc skips. Captured first, so a native dialog does not also take it as its own cancel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      skip()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [skip])

  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>(step.screen === 'outro' ? '[data-tour-meet]' : '[data-tour-next]')?.focus({ preventScroll: true })
  }, [step.screen, layer])

  // One cursor script per step: say the line, bring the target into view, hover / press / type, wait while it is
  // read, then move on inside the same screen (screens change only on 「다음」).
  const cursors: CursorConfig[] = useMemo(() => {
    if (reduced || !ready) return []
    const script: CursorStep[] = [{ action: 'say', text: step.say }]
    if (element) {
      script.push({
        action: 'call',
        run: () => {
          const rect = element.getBoundingClientRect()
          if (rect.top < 72 || rect.bottom > window.innerHeight - 96) element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        },
      })
      script.push({ action: 'wait', duration: 560 })
      const spec = { target: element, ...step.at }
      if (step.action === 'type' && step.text) script.push({ action: 'type', target: element, text: step.text })
      else if (step.action === 'click') script.push({ action: 'click', target: spec })
      else script.push({ action: 'hover', target: spec })
    } else {
      script.push({ action: 'move', to: { x: '50%', y: '42%' } })
    }
    script.push({ action: 'wait', duration: readMs(step.say) })
    if (next && next.screen === step.screen) script.push({ action: 'call', run: () => go(next, 1) })
    // The cursor carries on from the previous step's target while that is still on screen.
    const before = previous && previous.screen === step.screen ? findTarget(previous) : null
    const start: CursorTarget = before && before !== element ? { target: before, ...previous?.at } : { x: '50%', y: '74%' }
    return [{ id: 'chaerin', name: '채린', color: CHAERIN_COLOR, textColor: '#FFFFFF', start, script }]
  }, [reduced, ready, step, element, next, previous, go])

  const live = `${index + 1}/${steps.length}, ${SCREEN_LABELS[step.screen]}. 채린: ${step.say}${step.screen === 'outro' ? ' 메이트 만나러 가기 또는 다시 보기를 고를 수 있어요.' : ''}`
  // Reduced motion: 채린's line goes under the lit target, or above it when there is no room below (panel included).
  const lineBelow = spot ? spot.top + spot.height + 12 : 0
  const lineStyle = spot
    ? ({
        left: Math.max(16, Math.min(spot.left, window.innerWidth - 336)),
        ...(lineBelow + 72 > window.innerHeight - 96 ? { top: Math.max(16, spot.top - 12), transform: 'translateY(-100%)' } : { top: lineBelow }),
      } as CSSProperties)
    : undefined

  return createPortal(
    <div className="service-tour" data-reduced={reduced || undefined}>
      <div className="service-tour-dim" data-spot={spot ? 'true' : undefined} aria-hidden="true"
        style={spot ? ({ '--spot-left': `${spot.left}px`, '--spot-top': `${spot.top}px`, '--spot-width': `${spot.width}px`, '--spot-height': `${spot.height}px` } as CSSProperties) : undefined} />

      {!reduced && ready && (
        <ShowcasePointer
          cursors={cursors}
          loop={false}
          playing
          labelAnimation="fade"
          clickEffect
          className={`service-tour-pointer${step.labelSide === 'left' ? ' service-tour-pointer--label-left' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', '--service-tour-avatar': `url("${mateAvatar('chaerin')}")` } as CSSProperties}
          onCycle={() => setPreview(null)}
          onCursorPress={() => setPreview(step.id)}
        />
      )}

      {/* Visual presses: local previews only (nothing connects, plays or opens). */}
      {preview && lineBottom && PREVIEWS[preview] && (
        <div className="service-tour-preview" style={{ left: lineBottom.left, top: lineBottom.top } as CSSProperties} aria-hidden="true">
          {PREVIEWS[preview].map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}

      {reduced && ready && (
        <div className="service-tour-line" aria-hidden="true" style={lineStyle}>
          <img src={mateAvatar('chaerin')} alt="" width={24} height={24} />
          <span><b>채린</b>{step.say}</span>
        </div>
      )}

      {/* On the practice call the dock and the chat box sit at the bottom: the panel moves up there. */}
      <div ref={panel} className="service-tour-panel" data-place={step.screen === 'call' ? 'top' : undefined} role="dialog" aria-modal="true" aria-labelledby="service-tour-title">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{live}</p>
        <h2 id="service-tour-title" className="service-tour-title">
          캡슐 사용법 <span className="service-tour-count">{index + 1} / {steps.length}</span>
          <span className="service-tour-screen">{SCREEN_LABELS[step.screen]}</span>
        </h2>
        <div className="service-tour-actions">
          {step.screen !== 'outro' && <Button variant="ghost" size="sm" data-tour-skip onClick={skip}>건너뛰기</Button>}
          {previous && <Button variant="ghost" size="sm" onClick={() => go(previous, -1)}>이전</Button>}
          {step.screen === 'outro' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => go(steps[0]!, 1)}>다시 보기</Button>
              <Button size="sm" data-tour-meet onClick={meetMates}>메이트 만나러 가기</Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" data-tour-next onClick={() => next && go(next, 1)}>
              {next && next.screen !== step.screen ? `다음 · ${SCREEN_LABELS[next.screen]}` : '다음'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    layer,
  )
}

/** What a visual press shows (the real action never runs). */
const PREVIEWS: Readonly<Record<string, readonly string[]>> = {
  'home-connect': ['영상통화처럼 함께', '음성 대화', 'PIP로 띄우기'],
  'detail-voice': ['목소리 미리 듣기'],
  'detail-connect': ['연결하면 통화 화면이 열려요'],
  'call-leave': ['끊으면 연결 기록이 남아요'],
  'records-day': ['그날의 기록 카드'],
}
