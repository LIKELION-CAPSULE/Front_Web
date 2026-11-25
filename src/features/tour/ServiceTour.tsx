import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ShowcasePointer, type CursorConfig, type CursorStep, type CursorTarget } from '@/shared/ui/showcase-pointer/showcase-pointer'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { mateAvatar } from '@/features/mates/artwork'
import { resolveMateFeatures } from '@/features/mates/mate-features'
import { Button } from '@/shared/ui/Button'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { SCREEN_LABELS, readMs, tourHref, tourSteps, type TourStep } from './tour-steps'
import { focusTourTrigger, takeTourOrigin } from './tour-start'
import { chooseLabelSide, chooseLineBox, type Avoid, type Box, type LabelSide } from './tour-placement'
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
 * - The lock (inert app, no scrolling, the top-layer sheet and its move into the account modal) belongs to TourLayer,
 *   which holds it from the first frame, before this chunk has loaded; this renders inside it.
 * - Without a mate (none came back from the server) there is nothing to show: the tour says so and closes.
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

/**
 * What 채린's line must not cover: the visible controls around the target (not the target itself, its insides or the
 * box it sits in), only those in the open modal when one is open, and the tour panel.
 */
function avoidAround(target: Element | null): Avoid {
  const layer = document.querySelector('.service-tour-layer')
  const scope: ParentNode = document.querySelector('dialog[open]') ?? document
  const controls: Box[] = []
  const own = target?.getBoundingClientRect()
  for (const element of scope.querySelectorAll('a[href], button, input, select, textarea, [role="tab"], [role="button"], [tabindex="0"]')) {
    if (layer?.contains(element) || (target && (target.contains(element) || element.contains(target)))) continue
    if (element.checkVisibility && !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const rect = element.getBoundingClientRect()
    // A card-wide link laid over the card (home mate cards) covers the target's whole box: it is the target's card, not
    // a neighbour to keep clear of — otherwise every place near the target would count as covering it.
    if (own && rect.left <= own.left && rect.top <= own.top && rect.right >= own.right && rect.bottom >= own.bottom) continue
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) controls.push(rect)
  }
  const panel = document.querySelector('.service-tour-panel')?.getBoundingClientRect() ?? null
  return { controls, panel, viewport: { width: window.innerWidth, height: window.innerHeight } }
}

/** Where the arrow tip lands on the target (the step's `at`, its centre otherwise). */
function tipOf(element: Element, at: TourStep['at']) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width * (at?.x ?? 0.5), y: rect.top + rect.height * (at?.y ?? 0.5) }
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
  const { home, status } = useBackend()
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
  /** 채린's line (the cursor label) on screen: the press preview sits next to it. */
  const [label, setLabel] = useState<{ left: number; top: number; bottom: number } | null>(null)
  /** The label's side around the arrow, chosen when the cursor is about to land (per step). */
  const [placed, setPlaced] = useState<{ id: string; side: LabelSide; lift: number } | null>(null)
  /** Reduced motion: the line's measured size. */
  const [lineSize, setLineSize] = useState<{ width: number; height: number } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const atScreen = mateId !== '' && onScreen(step, location.pathname, search, mateId)
  /** On its screen with its target found (a step without a target, the outro, is ready on arrival). */
  const ready = atScreen && (step.targets.length === 0 || target?.id === step.id)
  const next = steps[index + 1]
  const previous = steps[index - 1]

  const go = useCallback((to: TourStep, toWay: 1 | -1) => {
    if (!context.mateId) return
    setPreview(null)
    navigate(tourHref(to, context), { replace: true, state: { tourWay: toWay } })
  }, [navigate, context])

  const skip = useCallback(() => {
    navigate(takeTourOrigin(), { replace: true })
    focusTourTrigger()
  }, [navigate])

  const meetMates = useCallback(() => {
    takeTourOrigin()
    navigate('/', { replace: true })
    window.setTimeout(() => {
      const heading = document.getElementById('mates-heading')
      heading?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
      heading?.focus({ preventScroll: true })
    }, 200)
  }, [navigate, reduced])

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
      const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
      const nextLabel = box ? { left: Math.round(box.left), top: Math.round(box.top), bottom: Math.round(box.bottom) } : null
      setLabel((old) => (old?.left === nextLabel?.left && old?.top === nextLabel?.top && old?.bottom === nextLabel?.bottom ? old : nextLabel))
      const line = document.querySelector('.service-tour-line')?.getBoundingClientRect()
      const size = line ? { width: Math.round(line.width), height: Math.round(line.height) } : null
      setLineSize((old) => (old?.width === size?.width && old?.height === size?.height ? old : size))
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [element])

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
  }, [step.screen])

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
      // Before landing: the side of the arrow where 채린's line covers none of the controls around the target.
      script.push({
        action: 'call',
        run: () => {
          const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
          const size = box && box.width ? { width: box.width, height: box.height } : { width: 300, height: 30 }
          const tip = tipOf(element, step.at)
          const lift = Math.max(0, tip.y - element.getBoundingClientRect().top)
          setPlaced({ id: step.id, side: chooseLabelSide(tip, size, avoidAround(element), preferredSide(step), lift), lift })
        },
      })
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
  const side: LabelSide = placed?.id === step.id ? placed.side : preferredSide(step)
  const lift = placed?.id === step.id ? placed.lift : 0
  // Reduced motion: 채린's line beside the lit target — below, above, right or left, wherever it covers no control.
  const lineBox = reduced && spot
    ? chooseLineBox({ left: spot.left, top: spot.top, right: spot.left + spot.width, bottom: spot.top + spot.height }, lineSize ?? { width: 320, height: 64 }, avoidAround(element))
    : null
  const lineStyle = lineBox ? ({ left: lineBox.left, top: lineBox.top } as CSSProperties) : undefined
  // The press preview sits next to 채린's line, on the side away from the arrow.
  const previewStyle = label
    ? ({ left: label.left, ...(side.endsWith('up') ? { top: label.top - 8, translate: '0 -100%' } : { top: label.bottom + 8 }) } as CSSProperties)
    : undefined

  // No mate to show (the server listed none, or home is still loading): say so; nothing waits or navigates.
  if (!mateId) {
    const loading = status === 'loading' || (home === null && status !== 'error')
    return (
      <div className="service-tour">
        <div className="service-tour-dim" aria-hidden="true" />
        <div ref={panel} className="service-tour-panel" role="dialog" aria-modal="true" aria-label="캡슐 사용법">
          <p className="service-tour-loading-text" role="status">
            {loading ? '사용법 불러오는 중' : '메이트를 불러오지 못해서 사용법을 보여 줄 수 없어요'}
          </p>
          <div className="service-tour-actions">
            <Button variant={loading ? 'ghost' : 'secondary'} size="sm" data-tour-next onClick={skip}>{loading ? '건너뛰기' : '닫기'}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
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
          className={`service-tour-pointer${side.startsWith('left') ? ' service-tour-pointer--label-left' : ''}${side.endsWith('up') ? ' service-tour-pointer--label-up' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', '--service-tour-avatar': `url("${mateAvatar('chaerin')}")`, '--service-tour-label-lift': `${Math.round(lift)}px` } as CSSProperties}
          onCycle={() => setPreview(null)}
          onCursorPress={() => setPreview(step.id)}
        />
      )}

      {/* Visual presses: local previews only (nothing connects, plays or opens). */}
      {preview && previewStyle && PREVIEWS[preview] && (
        <div className="service-tour-preview" style={previewStyle} aria-hidden="true">
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
    </div>
  )
}

/** The step's own side for the label (right edge targets open to the left). */
function preferredSide(step: TourStep): LabelSide {
  return step.labelSide === 'left' ? 'left-down' : 'right-down'
}

/** What a visual press shows (the real action never runs). */
const PREVIEWS: Readonly<Record<string, readonly string[]>> = {
  'home-connect': ['영상통화처럼 함께', '음성 대화', 'PIP로 띄우기'],
  'detail-voice': ['목소리 미리 듣기'],
  'detail-connect': ['연결하면 통화 화면이 열려요'],
  'call-leave': ['끊으면 연결 기록이 남아요'],
  'records-day': ['그날의 기록 카드'],
}
