import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ShowcasePointer, type CursorConfig, type CursorStep, type CursorTarget } from '@/shared/ui/showcase-pointer/showcase-pointer'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { mateAvatar } from '@/features/mates/artwork'
import { resolveMateFeatures } from '@/features/mates/mate-features'
import { Button } from '@/shared/ui/Button'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { SCREEN_LABELS, nextScreenStep, readMs, tourHref, tourSteps, type TourMark, type TourStep } from './tour-steps'
import { focusTourTrigger, takeTourOrigin } from './tour-start'
import { chooseLabelSide, chooseLineBox, type Avoid, type Box, type LabelSide } from './tour-placement'
import { Spotlight, easeOutCubic, type SpotMotion, type SpotRect } from './tour-spotlight'
import './service-tour.css'

/**
 * The service tour controller (`?tour=<step>` on any screen; App mounts it). One cursor, 「채린」 (Showcase Pointer),
 * walks the whole service; see tour-steps.ts for the script.
 *
 * - Screens change only when the user presses 「다음」/「이전」/「이 화면 건너뛰기」 (the controller navigates); inside a screen a
 *   step moves on by itself once its line has been read. The cursor's click is a visual press: `onCursorPress` shows a
 *   local preview only, nothing is clicked, submitted, played or navigated.
 * - A step visits its marks in order. The lit area and the cursor leave together — same moment, same duration, same
 *   easing (`MOVE_MS`, `MOVE_EASING`); a pause comes first only when the page had to scroll. Marks close together are
 *   lit as one area (the cursor moves inside it); far apart, the light moves with the cursor from mark to mark.
 * - The address keeps the step, so a reload resumes it. 「그만보기」 (or Esc) returns to the screen the tour started from.
 * - After arriving, the controller waits for the step's first mark (a MutationObserver, up to `waitMs`); one that does
 *   not show up in time is skipped in the direction of travel.
 * - Nothing is measured per frame: the light is placed when a move starts, and again only on a scroll, a resize or a
 *   size change of what it lights (tour-spotlight.ts moves it on the compositor).
 * - The lock (inert app, no scrolling, the top-layer sheet and its move into the account modal) belongs to TourLayer,
 *   which holds it from the first frame, before this chunk has loaded; this renders inside it.
 * - Without a mate (none came back from the server) there is nothing to show: the tour says so and closes.
 * - Reduced motion: no cursor or movement; the step's area is lit and 채린's line sits beside it, paced by 「다음」.
 */

const PAD = 8
const CHAERIN_COLOR = '#8053F2'
const DEFAULT_WAIT_MS = 4000
/** One move of the cursor and the light: the same length and easing for both. */
export const MOVE_MS = 600
/** The cursor's `ease-out` (1 − (1 − t)³), so the light and the arrow ease alike. */
export const MOVE_EASING = easeOutCubic
const POINTER_MOTION = { easing: 'ease-out', overshoot: 0, curvature: 0.7 } as const
/** Only when the target had to be scrolled into view: let the smooth scroll settle before the move. */
const SCROLL_SETTLE_MS = 560
/** A rest on each mark before the next one. */
const DWELL_MS = 900
/** Marks whose joint box covers at most this share of the screen are lit as one area. */
const JOINT_AREA_MAX = 0.3

function findTarget(targets: readonly string[]): Element | null {
  for (const selector of targets) {
    const element = document.querySelector(selector)
    if (element && element.getClientRects().length) return element
  }
  return null
}

/** The box lighting `elements` (their joint box plus the padding), or null when none is drawn. */
function spotOf(elements: readonly Element[]): SpotRect | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    if (!rect.width && !rect.height) continue
    left = Math.min(left, rect.left); top = Math.min(top, rect.top); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom)
  }
  if (!Number.isFinite(left)) return null
  return { left: Math.round(left - PAD), top: Math.round(top - PAD), width: Math.round(right - left + PAD * 2), height: Math.round(bottom - top + PAD * 2) }
}

/** Light the marks as one area when that area is small enough; otherwise the light moves with the cursor. */
function litTogether(elements: readonly Element[]): boolean {
  if (elements.length < 2) return true
  const spot = spotOf(elements)
  return Boolean(spot && spot.width * spot.height <= JOINT_AREA_MAX * innerWidth * innerHeight)
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
    // A visually hidden input (a rail's radio, 1px) stands for the label drawn around it: avoid what is seen.
    const drawn = element.getBoundingClientRect()
    const rect = drawn.width < 4 || drawn.height < 4 ? element.closest('label')?.getBoundingClientRect() ?? drawn : drawn
    // A card-wide link laid over the card (home mate cards) covers the target's whole box: it is the target's card, not
    // a neighbour to keep clear of — otherwise every place near the target would count as covering it.
    if (own && rect.left <= own.left && rect.top <= own.top && rect.right >= own.right && rect.bottom >= own.bottom) continue
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) controls.push(rect)
  }
  const panel = document.querySelector('.service-tour-panel')?.getBoundingClientRect() ?? null
  return { controls, panel, viewport: { width: window.innerWidth, height: window.innerHeight } }
}

/** Where the arrow tip lands on the target (the mark's `at`, its centre otherwise). */
function tipOf(element: Element, at: TourMark['at']) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width * (at?.x ?? 0.5), y: rect.top + rect.height * (at?.y ?? 0.5) }
}

/** Brings the target into view; resolves at once when it is already there, after the scroll settles otherwise. */
function bringIntoView(element: Element): Promise<void> {
  const rect = element.getBoundingClientRect()
  if (rect.top >= 72 && rect.bottom <= window.innerHeight - 96) return Promise.resolve()
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return new Promise((resolve) => window.setTimeout(resolve, SCROLL_SETTLE_MS))
}

/** Finite animations running on the element or its ancestors (a dialog opening, a panel sliding in). */
function animationsAround(element: Element): Animation[] {
  const running: Animation[] = []
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (typeof node.getAnimations !== 'function') break
    for (const animation of node.getAnimations()) {
      const timing = animation.effect?.getComputedTiming()
      if (animation.playState === 'running' && timing && Number.isFinite(Number(timing.endTime))) running.push(animation)
    }
  }
  return running
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
      return pathname === '/' && search.get('account') === 'profile'
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
  const [target, setTarget] = useState<{ id: string; element: Element } | null>(null)
  const element = target?.id === step.id ? target.element : null
  /** 채린's line (the cursor label) when a press shows its preview: the preview sits next to it. */
  const [label, setLabel] = useState<{ left: number; top: number; bottom: number } | null>(null)
  /** The label's side around the arrow, chosen when the cursor is about to land (per mark). */
  const [placed, setPlaced] = useState<{ id: string; side: LabelSide; lift: number } | null>(null)
  /** Reduced motion: the line's measured size, and the lit box it sits beside. */
  const [lineSize, setLineSize] = useState<{ width: number; height: number } | null>(null)
  const [litBox, setLitBox] = useState<SpotRect | null>(null)
  /** Reduced motion: bumped once the page around the lit area has stopped moving (the line is placed again). */
  const [, setSettled] = useState(0)
  const [preview, setPreview] = useState<{ id: string; chips: readonly string[] } | null>(null)
  /** The mark the cursor is on its way to (its press shows that mark's preview). */
  const [visiting, setVisiting] = useState<{ id: string; at: number } | null>(null)
  const atScreen = mateId !== '' && onScreen(step, location.pathname, search, mateId)
  /** On its screen with its first mark found (a step without marks, the outro, is ready on arrival). */
  const ready = atScreen && (step.marks.length === 0 || target?.id === step.id)
  const next = steps[index + 1]
  const previous = steps[index - 1]
  const nextScreen = nextScreenStep(steps, index)

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

  // Wait for the first mark on its screen (watching the page, not polling); skip the step in the direction of travel
  // when it does not show up in time.
  useEffect(() => {
    if (!atScreen || !step.marks.length) return
    const first = step.marks[0]!.targets
    let done = false
    let cancelled = false
    let frame = 0
    const settle = (found: Element) => {
      done = true
      observer.disconnect()
      // A modal opening (or any animation on the way to the target) ends first: the light and the arrow aim at where the
      // target stays, not at a frame of its entrance.
      const moving = animationsAround(found)
      if (!moving.length) { window.clearTimeout(timer); setTarget({ id: step.id, element: found }); return }
      void Promise.all(moving.map((animation) => animation.finished.catch(() => undefined))).then(() => {
        if (cancelled) return
        window.clearTimeout(timer)
        setTarget({ id: step.id, element: found })
      })
    }
    // Found, it must also hold still for two frames (a modal opening, a board settling): the light and the arrow then
    // aim at where it stays. Only this short check runs per frame, and only until it holds.
    let last: string | null = null
    const check = () => {
      frame = 0
      const found = findTarget(first)
      if (!found || done) { last = null; return }
      const rect = found.getBoundingClientRect()
      const place = `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`
      if (place === last) { settle(found); return }
      last = place
      frame = requestAnimationFrame(check)
    }
    const observer = new MutationObserver(() => { if (!done && !frame) frame = requestAnimationFrame(check) })
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      observer.disconnect()
      const skipTo = steps[index + way] ?? (way > 0 ? steps.at(-1) : steps[0])
      if (skipTo && skipTo.id !== step.id) go(skipTo, way)
    }, step.waitMs ?? DEFAULT_WAIT_MS)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] })
    check()
    return () => { cancelled = true; done = true; observer.disconnect(); window.clearTimeout(timer); cancelAnimationFrame(frame) }
  }, [atScreen, step, steps, index, go, way])

  // ── The light ──
  const dimRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  /** The light and what it follows; one per tour mount (a plain object, so scripts can hold it). */
  const [light] = useState(() => new TourLight())
  useLayoutEffect(() => {
    if (!dimRef.current || !ringRef.current) return
    return light.attach(dimRef.current, ringRef.current, (box) => { if (reduced) setLitBox(box) }, () => {
      const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
      setLabel((old) => (old && box ? { left: Math.round(box.left), top: Math.round(box.top), bottom: Math.round(box.bottom) } : old))
    })
  }, [light, reduced, mateId])

  // A new screen starts dark (the light from the last screen lit something that is gone).
  const [litScreen, setLitScreen] = useState<string | null>(null)
  if (litScreen !== step.screen) {
    setLitScreen(step.screen)
    setLitBox(null)
  }
  useEffect(() => { light.clear() }, [light, step.screen])

  /** The step's marks that are on screen now, in order (the first is `element`). */
  const marks = useMemo(() => {
    if (!ready || !element) return []
    return step.marks.flatMap((mark, at) => {
      const found = at === 0 ? element : findTarget(mark.targets)
      return found ? [{ mark, element: found }] : []
    })
  }, [ready, element, step])

  // Reduced motion: the step's area (or its first mark when the marks are far apart) is lit at once and in view.
  useEffect(() => {
    if (!reduced || !marks.length) return
    const elements = marks.map((entry) => entry.element)
    const area = litTogether(elements) ? elements : elements.slice(0, 1)
    area[0]?.scrollIntoView({ block: 'center', behavior: 'instant' })
    light.lightUp(area, null)
    // What moves around it (a rail turning, a panel sliding in) settles, then the line is placed again (once).
    let alive = true
    const moving = document.getAnimations().filter((animation) => animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
    void Promise.all(moving.map((animation) => animation.finished.catch(() => undefined))).then(() => {
      if (alive) requestAnimationFrame(() => { if (alive) { light.lightUp(area, null); setSettled((value) => value + 1) } })
    })
    return () => { alive = false }
  }, [reduced, marks, light])

  // Esc ends the tour. Captured first, so a native dialog does not also take it as its own cancel.
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

  // One cursor script per step (buildScript below).
  const cursors: CursorConfig[] = useMemo(() => {
    if (reduced || !ready) return []
    return [buildScript({ step, marks, element, next, previous, go, light, place: setPlaced, visit: setVisiting })]
  }, [reduced, ready, step, marks, element, next, previous, go, light])

  /** A visual press: the visited mark's preview next to 채린's line (measured now, and again only on a scroll). */
  const onPress = useCallback(() => {
    const chips = visiting?.id === step.id ? marks[visiting.at]?.mark.preview : undefined
    if (!chips) return
    const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
    setLabel(box ? { left: Math.round(box.left), top: Math.round(box.top), bottom: Math.round(box.bottom) } : null)
    setPreview({ id: step.id, chips })
  }, [visiting, marks, step.id])

  // Reduced motion: the line's size, measured when it changes (not per frame).
  const lineObserver = useRef<ResizeObserver | null>(null)
  const lineRef = useCallback((node: HTMLDivElement | null) => {
    lineObserver.current?.disconnect()
    if (!node) return
    const measure = () => {
      const box = node.getBoundingClientRect()
      const size = { width: Math.round(box.width), height: Math.round(box.height) }
      setLineSize((old) => (old?.width === size.width && old?.height === size.height ? old : size))
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      lineObserver.current = new ResizeObserver(measure)
      lineObserver.current.observe(node)
    }
  }, [])

  const live = `${index + 1}/${steps.length}, ${SCREEN_LABELS[step.screen]}. 채린: ${step.say}${step.screen === 'outro' ? ' 메이트 만나러 가기 또는 다시 보기를 고를 수 있어요.' : ''}`
  const side: LabelSide = placed?.id === step.id ? placed.side : preferredSide(step)
  const lift = placed?.id === step.id ? placed.lift : 0
  // Reduced motion: 채린's line beside the lit area — below, above, right or left, wherever it covers no control.
  const lineBox = reduced && litBox
    ? chooseLineBox({ left: litBox.left, top: litBox.top, right: litBox.left + litBox.width, bottom: litBox.top + litBox.height }, lineSize ?? { width: 320, height: 64 }, avoidAround(marks[0]?.element ?? null))
    : null
  const lineStyle = lineBox ? ({ left: lineBox.left, top: lineBox.top } as CSSProperties) : undefined
  // The press preview sits next to 채린's line, on the side away from the arrow.
  const shownPreview = preview?.id === step.id ? preview.chips : null
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
            <Button variant={loading ? 'ghost' : 'secondary'} size="sm" data-tour-next onClick={skip}>{loading ? '그만보기' : '닫기'}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="service-tour" data-reduced={reduced || undefined}>
      {/* The dim with its lit hole: shades and corner caps moved by transform only (tour-spotlight.ts). */}
      <div ref={dimRef} className="service-tour-dim" data-shades="" aria-hidden="true">
        <div className="service-tour-shade" data-side="top" />
        <div className="service-tour-shade" data-side="bottom" />
        <div className="service-tour-shade" data-side="left" />
        <div className="service-tour-shade" data-side="right" />
        <div className="service-tour-corner" data-corner="tl" />
        <div className="service-tour-corner" data-corner="tr" />
        <div className="service-tour-corner" data-corner="bl" />
        <div className="service-tour-corner" data-corner="br" />
      </div>
      <div ref={ringRef} className="service-tour-spot" aria-hidden="true" />

      {!reduced && ready && (
        <ShowcasePointer
          cursors={cursors}
          loop={false}
          playing
          labelAnimation="fade"
          clickEffect
          motion={POINTER_MOTION}
          className={`service-tour-pointer${side.startsWith('left') ? ' service-tour-pointer--label-left' : ''}${side.endsWith('up') ? ' service-tour-pointer--label-up' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', '--service-tour-avatar': `url("${mateAvatar('chaerin')}")`, '--service-tour-label-lift': `${Math.round(lift)}px` } as CSSProperties}
          onCycle={() => setPreview(null)}
          onCursorPress={onPress}
        />
      )}

      {/* Visual presses: local previews only (nothing connects, plays or opens). */}
      {shownPreview && previewStyle && (
        <div className="service-tour-preview" style={previewStyle} aria-hidden="true">
          {shownPreview.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}

      {reduced && ready && (
        <div ref={lineRef} className="service-tour-line" aria-hidden="true" style={lineStyle}>
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
          {step.screen !== 'outro' && <Button variant="ghost" size="sm" data-tour-skip onClick={skip}>그만보기</Button>}
          {/* The rest of this screen's steps: on to the next screen's first step. */}
          {nextScreen && next && next.screen === step.screen && (
            <Button variant="ghost" size="sm" data-tour-skip-screen onClick={() => go(nextScreen, 1)}>이 화면 건너뛰기</Button>
          )}
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

/**
 * 채린's script for a step: say the line, then for each mark — scroll it into view only if needed, then the light and
 * the arrow leave together — and rest; then move on inside the same screen (screens change only on 「다음」).
 */
function buildScript({ step, marks, element, next, previous, go, light, place, visit }: {
  step: TourStep
  marks: readonly { mark: TourMark; element: Element }[]
  element: Element | null
  next: TourStep | undefined
  previous: TourStep | undefined
  go: (to: TourStep, way: 1 | -1) => void
  light: TourLight
  place: (placed: { id: string; side: LabelSide; lift: number }) => void
  visit: (visiting: { id: string; at: number }) => void
}): CursorConfig {
  const script: CursorStep[] = [{ action: 'say', text: step.say }]
  const elements = marks.map((entry) => entry.element)
  const together = litTogether(elements)
  marks.forEach(({ mark, element: markElement }, at) => {
    script.push({ action: 'call', run: () => bringIntoView(together && at === 0 && elements.length > 1 ? elements[0]! : markElement) })
    script.push({
      action: 'call',
      run: () => {
        // Before landing: the side of the arrow where 채린's line covers none of the controls around the target.
        const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
        const size = box && box.width ? { width: box.width, height: box.height } : { width: 300, height: 30 }
        const tip = tipOf(markElement, mark.action === 'type' ? undefined : mark.at)
        const lift = Math.max(0, tip.y - markElement.getBoundingClientRect().top)
        place({ id: step.id, side: chooseLabelSide(tip, size, avoidAround(markElement), preferredSide(step), lift), lift })
        visit({ id: step.id, at })
        // The light leaves with the arrow (the hover below starts on the next frame, with the same duration).
        if (!together || at === 0) light.lightUp(together ? elements : [markElement], { duration: MOVE_MS, ease: MOVE_EASING })
      },
    })
    const spec: CursorTarget = mark.action === 'type' ? { target: markElement } : { target: markElement, ...mark.at }
    script.push(mark.action === 'click' ? { action: 'click', target: spec, duration: MOVE_MS } : { action: 'hover', target: spec, duration: MOVE_MS })
    if (mark.action === 'type' && mark.text) script.push({ action: 'type', target: markElement, text: mark.text })
    if (at < marks.length - 1) script.push({ action: 'wait', duration: DWELL_MS })
  })
  if (!marks.length) script.push({ action: 'move', to: { x: '50%', y: '42%' }, duration: MOVE_MS })
  script.push({ action: 'wait', duration: Math.max(1600, readMs(step.say) - Math.max(0, marks.length - 1) * (MOVE_MS + DWELL_MS)) })
  if (next && next.screen === step.screen) script.push({ action: 'call', run: () => go(next, 1) })
  // The cursor carries on from the previous step's last mark while that is still on screen.
  const lastMark = previous && previous.screen === step.screen ? previous.marks.at(-1) : undefined
  const before = lastMark ? findTarget(lastMark.targets) : null
  const start: CursorTarget = before && before !== element ? { target: before, ...lastMark?.at } : { x: '50%', y: '74%' }
  return { id: 'chaerin', name: '채린', color: CHAERIN_COLOR, textColor: '#FFFFFF', start, script }
}

/**
 * The lit hole and what it follows: the elements lit now, re-measured on a scroll, a resize or a size change of them
 * (once per frame at most), never per frame otherwise.
 */
class TourLight {
  private spotlight: Spotlight | null = null
  private lit: readonly Element[] = []
  private resize: ResizeObserver | null = null
  private onLit: (box: SpotRect | null) => void = () => {}

  /** Mounts on the dim and the ring; `onLit` hears every placed box, `onFollow` every re-measure. Returns the cleanup. */
  attach(dim: HTMLElement, ring: HTMLElement, onLit: (box: SpotRect | null) => void, onFollow: () => void) {
    const spotlight = new Spotlight(dim, ring)
    this.spotlight = spotlight
    this.onLit = onLit
    let frame = 0
    const follow = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const box = this.lit.length ? spotOf(this.lit) : null
        if (!spotlight.moving && this.lit.length) spotlight.place(box)
        this.onLit(box)
        onFollow()
      })
    }
    const onResize = () => { spotlight.resize(); follow() }
    this.resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(follow)
    for (const node of this.lit) this.resize?.observe(node)
    window.addEventListener('scroll', follow, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', follow, { capture: true })
      window.removeEventListener('resize', onResize)
      this.resize?.disconnect()
      this.resize = null
      cancelAnimationFrame(frame)
      spotlight.dispose()
      if (this.spotlight === spotlight) this.spotlight = null
    }
  }

  /** Lights `elements` (eased with the cursor when `motion` is given) and follows them from now on. */
  lightUp(elements: readonly Element[], motion: SpotMotion | null) {
    this.lit = elements
    this.resize?.disconnect()
    for (const node of elements) this.resize?.observe(node)
    const box = spotOf(elements)
    this.spotlight?.place(box, motion)
    requestAnimationFrame(() => this.onLit(box))
  }

  /** Dark again: nothing lit. */
  clear() {
    this.lit = []
    this.resize?.disconnect()
    this.spotlight?.place(null)
  }
}
