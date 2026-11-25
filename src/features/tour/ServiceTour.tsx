import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ShowcasePointer, type CursorConfig, type CursorPath, type CursorStep, type CursorTarget } from '@/shared/ui/showcase-pointer/showcase-pointer'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { mateAvatar } from '@/features/mates/artwork'
import { resolveMateFeatures } from '@/features/mates/mate-features'
import { Button } from '@/shared/ui/Button'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { SCREEN_LABELS, nextScreenStep, readMs, tourHref, tourSteps, type TourMark, type TourStep } from './tour-steps'
import { focusTourTrigger, takeTourOrigin } from './tour-start'
import { chooseLabelSide, chooseLineBox, chooseRestingPlace, labelShift, type Avoid, type Box, type LabelSide } from './tour-placement'
import { Spotlight, insideScreen, type SpotMotion, type SpotRect } from './tour-spotlight'
import { planPath, type Point } from './tour-motion'
import './service-tour.css'

/**
 * The service tour controller (`?tour=<step>` on any screen; App mounts it). One cursor, 「채린」 (Showcase Pointer),
 * walks the whole service; see tour-steps.ts for the script.
 *
 * - Screens change only when the user presses 「다음」/「이전」/「이 화면 건너뛰기」 (the controller navigates); inside a screen a
 *   step moves on by itself once its line has been read. The cursor's click is a visual press: `onCursorPress` shows a
 *   local preview only, nothing is clicked, submitted, played or navigated.
 * - A step visits its marks in order (tour-motion.ts): the cursor bows a little toward the middle of the screen, speeds
 *   up and slows down like a hand (300–800 ms by distance) and flows through the marks it only points at; it stops
 *   where it presses or types. The lit area leaves on the same frame and follows on a spring (tour-spotlight.ts).
 *   Marks close together are lit as one area (the cursor moves inside it); far apart, the light moves mark to mark.
 * - A target out of view scrolls in while the cursor already moves (no wait): the move aims at where the target will
 *   be, then bends onto where it is, and the cursor stays on it until the scroll ends.
 * - 채린's line fades out when the step changes and rises in (opacity, 5px) when the cursor reaches the first mark.
 * - One cursor walks the whole tour: it stays mounted from step to step and carries on from where it is (the pointer's
 *   `resume`). The tour also stays mounted from screen to screen (TourOverlay sits outside App's route Suspense): on a
 *   new screen the cursor and the lit area hold still until its first mark shows up, then carry on. Only the account
 *   modal moves the tour layer (a remount): the new cursor starts where the old one was, fading in rather than popping.
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
/** The built-in reach for the pointer's own small moves (before typing): no overshoot, a light bow. */
const POINTER_MOTION = { overshoot: 0, curvature: 0.7 } as const
/** The arrow's idle sway at rest: at most ~2 px, slow (the pointer's sines, periods of ~2–9 s). */
const IDLE_DRIFT_PX = 1.5
/** After a press: a short beat so the press reads before the cursor moves on. */
const CLICK_REST_MS = 220
/** The last step's line fades out this long before the new one is set (service-tour.css). */
const LINE_OUT_MS = 140
/** The least time the line stays after the step's last move. */
const MIN_REST_MS = 1400
/** Marks whose joint box covers at most this share of the screen are lit as one area. */
const JOINT_AREA_MAX = 0.3
/**
 * Where the cursor was on the screen (viewport px) when the tour unmounted, for the next mount — a new address or the
 * account modal, a moment later (a tour opened afresh later starts low in the middle again).
 */
let lastCursor: (Point & { at: number }) | null = null
const CARRY_OVER_MS = 4000
/**
 * Where the pointer's own box starts on the screen. Inside the account modal the layer's fixed box can start off the
 * viewport's corner (tour-spotlight.ts has the same): the cursor works in that box's px, tips and the screen in viewport
 * px. Measured when the pointer mounts and at each move, never per frame.
 */
let pointerOrigin: Point = { x: 0, y: 0 }
/** The mounted tour's cursor element (held even once the account modal around it is gone). */
let liveCursor: HTMLElement | null = null

/**
 * Where 채린's cursor is on the screen now, read from its last drawn place (null when none is shown). The account modal
 * opening or closing renders the next tour before the last one unmounts (closing, the modal may already be gone).
 */
function cursorOnScreen(): Point | null {
  const cursor = liveCursor
  if (!cursor?.hasAttribute('data-visible')) return null
  const x = parseFloat(cursor.style.getPropertyValue('--cursor-x'))
  const y = parseFloat(cursor.style.getPropertyValue('--cursor-y'))
  const box = cursor.isConnected ? cursor.closest('.service-tour-pointer')?.getBoundingClientRect() : null
  const origin = box ? { x: box.left, y: box.top } : pointerOrigin
  return Number.isFinite(x) && Number.isFinite(y) ? { x: x + origin.x, y: y + origin.y } : null
}
function measurePointerOrigin(): Point {
  const box = document.querySelector('.service-tour-pointer')?.getBoundingClientRect()
  if (box) pointerOrigin = { x: box.left, y: box.top }
  return pointerOrigin
}

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
  return insideScreen({ left: Math.round(left - PAD), top: Math.round(top - PAD), width: Math.round(right - left + PAD * 2), height: Math.round(bottom - top + PAD * 2) }, window.innerWidth)
}

/** Light the marks as one area when that area is small enough; otherwise the light moves with the cursor. */
function litTogether(elements: readonly Element[]): boolean {
  if (elements.length < 2) return true
  const spot = spotOf(elements)
  return Boolean(spot && spot.width * spot.height <= JOINT_AREA_MAX * innerWidth * innerHeight)
}

/** Subjects larger than this share of the screen (a whole scene, a page block) are not kept clear: they cannot be. */
const SUBJECT_AREA_MAX = 0.4

/**
 * What 채린's line must not cover: the visible controls around the target (not the target itself, its insides or the
 * box it sits in), only those in the open modal when one is open, and the tour panel. And, as a tie-break among places
 * that cover none of those, the subjects it should leave readable (UX review 9-1): the target itself, the screen's other
 * tour targets (`data-tour`, e.g. the affinity title next to 함께한 시간) and headings — not the boxes around the target,
 * nor ones too large to keep clear of.
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
  const subjects: Box[] = []
  const screenArea = window.innerWidth * window.innerHeight
  for (const element of scope.querySelectorAll('[data-tour], h1, h2, h3')) {
    if (layer?.contains(element) || (target && element !== target && element.contains(target))) continue
    if (element.checkVisibility && !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const rect = element.getBoundingClientRect()
    if (rect.width * rect.height > SUBJECT_AREA_MAX * screenArea) continue
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) subjects.push(rect)
  }
  return { controls, panel, subjects, viewport: { width: window.innerWidth, height: window.innerHeight } }
}

/** Where the arrow tip lands on the target (the mark's `at`, its centre otherwise). */
function tipOf(element: Element, at: TourMark['at']) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width * (at?.x ?? 0.5), y: rect.top + rect.height * (at?.y ?? 0.5) }
}

/** Clear of the header and the tour panel. */
function inView(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  return rect.top >= 72 && rect.bottom <= window.innerHeight - 96
}

/** The boxes that scroll around `element` (and the page), with their offsets now. */
function scrollersOf(element: Element): { node: Element; left: number; top: number }[] {
  const nodes = new Set<Element>()
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) nodes.add(node)
  }
  if (document.scrollingElement) nodes.add(document.scrollingElement)
  return [...nodes].map((node) => ({ node, left: node.scrollLeft, top: node.scrollTop }))
}

/**
 * Brings `element` into view without waiting: when it is out of view, `measure` runs on the page as it will be once
 * scrolled (scrolled there at once, measured, put back — nothing is painted in between), then the smooth scroll starts
 * and the cursor leaves at the same time. In view already, `measure` runs on the page as it is.
 */
function scrollingInto<T>(element: Element, measure: () => T): T {
  if (inView(element)) return measure()
  const saved = scrollersOf(element)
  element.scrollIntoView({ block: 'center', behavior: 'instant' })
  const result = measure()
  for (const { node, left, top } of saved) node.scrollTo({ left, top, behavior: 'instant' })
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return result
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
    return { mateId, features: { affinity: features.affinity, world: features.affinity && features.world } }
  }, [mateId, featureOverride])
  const steps = useMemo(() => tourSteps(context), [context])
  const stepId = search.get('tour')
  const found = steps.findIndex((value) => value.id === stepId)
  const index = Math.max(0, found)
  const step = steps[index]!
  // The direction of travel rides along in the history state (kept across a remount), and a missing target is
  // skipped the same way the user was going.
  const way: 1 | -1 = (location.state as { tourWay?: 1 | -1 } | null)?.tourWay === -1 ? -1 : 1
  const [target, setTarget] = useState<{ id: string; element: Element } | null>(null)
  const element = target?.id === step.id ? target.element : null
  /** 채린's line (the cursor label) when a press shows its preview: the preview sits next to it. */
  const [label, setLabel] = useState<{ left: number; top: number; bottom: number } | null>(null)
  /** The label's side around the arrow, chosen when the cursor is about to land (per mark). */
  const [placed, setPlaced] = useState<{ id: string; side: LabelSide; lift: number; shift: number } | null>(null)
  /** Reduced motion: the line's measured size, and the lit box it sits beside. */
  const [lineSize, setLineSize] = useState<{ width: number; height: number } | null>(null)
  const [litBox, setLitBox] = useState<SpotRect | null>(null)
  /** Reduced motion: bumped once the page around the lit area has stopped moving (the line is placed again). */
  const [, setSettled] = useState(0)
  const [preview, setPreview] = useState<{ id: string; chips: readonly string[] } | null>(null)
  /** The mark the cursor is on its way to (its press shows that mark's preview). */
  const [visiting, setVisiting] = useState<{ id: string; at: number } | null>(null)
  /** The step whose line 채린 is saying now (shown from the cursor's first arrival; any other step: faded out). */
  const [lineFor, setLineFor] = useState<string | null>(null)
  /** When the step changed (the old line starts fading out then); a plain holder the script reads later. */
  const [stepAt] = useState(() => new StepClock())
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

  // A new screen: the lit area stays where it was (what it lit is gone; it no longer follows) until the screen's first
  // mark shows up, then moves there with the cursor. Reduced motion has no move to make: the new screen starts dark, as
  // does the outro (nothing to light).
  const [litScreen, setLitScreen] = useState<string | null>(null)
  if (litScreen !== step.screen) {
    setLitScreen(step.screen)
    setLitBox(null)
  }
  useEffect(() => { if (reduced || !step.marks.length) light.clear() }, [light, step.screen, step.marks.length, reduced])

  /** The step's marks that are on screen now, in order (the first is `element`). */
  const marks = useMemo(() => {
    if (!ready || !element) return []
    return step.marks.flatMap((mark, at) => {
      const found = at === 0 ? element : findTarget(mark.targets)
      // `lit`: the box around the target that is lit (the whole composer around the field typed into).
      return found ? [{ mark, element: found, lit: (mark.lit && found.closest(mark.lit)) || found }] : []
    })
  }, [ready, element, step])

  // Reduced motion: the step's area (or its first mark when the marks are far apart) is lit at once and in view.
  useEffect(() => {
    if (!reduced || !marks.length) return
    const elements = marks.map((entry) => entry.lit)
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

  useLayoutEffect(() => { stepAt.mark(step.id) }, [stepAt, step.id])
  // The account modal moves the tour layer (a remount; so did every new address before TourOverlay): the next mount's cursor
  // starts where this one is now (its last drawn place, so a follow or the sway after the last move counts too).
  // The cursor element is held from mount: by the time this unmounts, TourLayer may have taken the layer out of the page.
  useLayoutEffect(() => {
    const cursor = dimRef.current?.parentElement?.querySelector<HTMLElement>('.service-tour-pointer .showcase-pointer-cursor')
    if (!cursor) return
    measurePointerOrigin()
    liveCursor = cursor
    return () => {
      const at = cursorOnScreen()
      if (at) lastCursor = { ...at, at: performance.now() }
      if (liveCursor === cursor) liveCursor = null
    }
  }, [reduced, mateId])

  // One cursor for the whole tour: a script per step (buildScript below); between steps, while the next step's first
  // mark is awaited, it rests where it is (an empty script, `resume`).
  const [start] = useState<CursorTarget>(() => {
    const at = cursorOnScreen() ?? (lastCursor && performance.now() - lastCursor.at < CARRY_OVER_MS ? lastCursor : null)
    return at ? { x: at.x, y: at.y, client: true } : { x: '50%', y: '74%' }
  })
  const cursors: CursorConfig[] = useMemo(() => {
    if (reduced) return []
    if (!ready) return [{ ...CURSOR, start, script: [] }]
    return [buildScript({ step, marks, next, go, light, start, stepAt, place: setPlaced, visit: setVisiting, showLine: setLineFor })]
  }, [reduced, ready, step, marks, next, go, light, start, stepAt])

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
  const shift = placed?.id === step.id ? placed.shift : 0
  // Reduced motion: 채린's line beside the lit area — below, above, right or left, wherever it covers no control.
  const lineBox = reduced && litBox
    ? chooseLineBox({ left: litBox.left, top: litBox.top, right: litBox.left + litBox.width, bottom: litBox.top + litBox.height }, lineSize ?? { width: 320, height: 64 }, avoidAround(marks[0]?.lit ?? null))
    : null
  // Until the new screen's area is lit the line has no place: hidden (still measured), not at the centre over the page.
  // With nothing to light (the outro, a missing target) it keeps the centre.
  const lineStyle = lineBox
    ? ({ left: lineBox.left, top: lineBox.top } as CSSProperties)
    : marks.length ? ({ visibility: 'hidden' } as CSSProperties) : undefined
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

      {!reduced && (
        <ShowcasePointer
          cursors={cursors}
          loop={false}
          playing
          labelAnimation="none"
          clickEffect
          idleDrift={IDLE_DRIFT_PX}
          motion={POINTER_MOTION}
          className={`service-tour-pointer${side.startsWith('left') ? ' service-tour-pointer--label-left' : ''}${side.endsWith('up') ? ' service-tour-pointer--label-up' : ''}${lineFor === step.id ? ' service-tour-pointer--line' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', '--service-tour-avatar': `url("${mateAvatar('chaerin')}")`, '--service-tour-label-lift': `${Math.round(lift)}px`, '--service-tour-label-shift': `${Math.round(shift)}px` } as CSSProperties}
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
 * Counts the arrow's planned moves on the pointer (`data-tour-moves`): check-service-tour.mjs times each move's start
 * against the light's (`data-moving` on the dim) — one attribute write per move, nothing per frame.
 */
function stampMove() {
  const pointer = document.querySelector<HTMLElement>('.service-tour-pointer')
  if (pointer) pointer.dataset.tourMoves = String(Number(pointer.dataset.tourMoves ?? 0) + 1)
}

/** When the current step began (its old line started fading out then). */
class StepClock {
  private id = ''
  private at = 0
  mark(id: string) {
    if (id === this.id) return
    this.id = id
    this.at = performance.now()
  }
  /** ms since `id` began (a long time when another step is current). */
  since(id: string) { return id === this.id ? performance.now() - this.at : Infinity }
}

/** 채린's cursor (the same id throughout, so it is one cursor). */
const CURSOR = { id: 'chaerin', name: '채린', color: CHAERIN_COLOR, textColor: '#FFFFFF', resume: true } as const

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, ms)))
/** After React has rendered what was just set (two frames). */
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

/**
 * 채린's script for a step: let the last line fade out and set this one (still hidden); for each mark, start the scroll
 * if it is out of view, then the arrow and the light leave together (the path aims at where the mark will be), flowing
 * through the marks it only points at; the line rises in when the arrow reaches the first mark; it stays until read;
 * then the step moves on inside the same screen (screens change only on 「다음」).
 */
function buildScript({ step, marks, next, go, light, start, stepAt, place, visit, showLine }: {
  step: TourStep
  marks: readonly { mark: TourMark; element: Element; lit: Element }[]
  next: TourStep | undefined
  go: (to: TourStep, way: 1 | -1) => void
  light: TourLight
  start: CursorTarget
  stepAt: StepClock
  place: (placed: { id: string; side: LabelSide; lift: number; shift: number }) => void
  visit: (visiting: { id: string; at: number }) => void
  showLine: (id: string) => void
}): CursorConfig {
  const elements = marks.map((entry) => entry.lit)
  const together = litTogether(elements)
  /** The pointer's own px (see pointerOrigin): a screen point there, and the middle of the screen the paths bow to. */
  const local = (point: Point, origin: Point) => ({ x: point.x - origin.x, y: point.y - origin.y })
  const centerIn = (origin: Point) => local({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, origin)
  /** Per mark: where the tip lands and the lit box, as they will be once any scroll ends. */
  const aims: { tip: Point; spot: SpotRect | null }[] = []
  /** The velocity a move hands on to the next one (it flows through a mark), and when the line was shown. */
  const run = { carry: null as Point | null, lineAt: 0 }
  // Typing aims at the field's centre (no landing jitter), every other mark at its `at`.
  const aimOf = (at: number) => {
    const { mark } = marks[at]!
    return mark.action === 'type' ? { x: 0.5, y: 0.5 } : mark.at
  }
  const lights = (at: number) => !together || at === 0
  const litAt = (at: number) => (together ? elements : [elements[at]!])

  const script: CursorStep[] = [
    { action: 'call', run: () => sleep(LINE_OUT_MS - stepAt.since(step.id)) },
    { action: 'say', text: step.say },
    // The new line is rendered (still hidden) before the first mark's side is chosen from its size.
    { action: 'call', run: nextPaint },
  ]
  const sayIt: CursorStep = { action: 'call', run: () => { run.lineAt = performance.now(); showLine(step.id) } }

  marks.forEach(({ mark, element: markElement, lit: litElement }, at) => {
    script.push({
      action: 'call',
      run: () => {
        // The scroll (when needed) starts now; the side of the arrow for 채린's line, the tip and the lit box are
        // measured on the page as it will be once scrolled.
        aims[at] = scrollingInto(markElement, () => {
          const tip = tipOf(markElement, aimOf(at))
          const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
          const size = box && box.width ? { width: box.width, height: box.height } : { width: 300, height: 30 }
          // Above, the line clears the target's row. A mark lighting a box around its target (the composer around the
          // field typed into) clears the whole box from anywhere inside it — the field can shift in the composer before
          // the arrow lands — so the typed words stay in view (UX review 9-1).
          const litRect = litElement.getBoundingClientRect()
          const lift = litElement === markElement ? Math.max(0, tip.y - litRect.top) : Math.max(0, tip.y - litRect.top, litRect.height) + 12
          const side = chooseLabelSide(tip, size, avoidAround(litElement), preferredSide(step), lift)
          place({ id: step.id, side, lift, shift: labelShift(side, tip, size, window.innerWidth) })
          return { tip, spot: lights(at) ? spotOf(litAt(at)) : null }
        })
        visit({ id: step.id, at })
      },
    })
    // Passes through a mark it only points at when the next one is in view and not a sharp turn back (planPath).
    const following = marks[at + 1]
    const path: CursorPath = (from) => {
      const origin = measurePointerOrigin()
      const then = mark.action === 'hover' && following && inView(following.element) ? local(tipOf(following.element, aimOf(at + 1)), origin) : null
      const plan = planPath(from, local(aims[at]!.tip, origin), { center: centerIn(origin), enter: run.carry, then })
      run.carry = then ? plan.exit : null
      stampMove()
      // The light leaves on this frame too, on the arrow's own progress (its spring chases it).
      if (lights(at)) light.lightUp(litAt(at), { duration: plan.duration, ease: plan.progress }, aims[at]!.spot)
      return plan
    }
    const spec: CursorTarget = { target: markElement, ...aimOf(at) }
    script.push({ action: 'hover', target: spec, path, follow: true, flow: true })
    if (at === 0) script.push(sayIt)
    if (mark.action === 'click') {
      // Already on it: the press only (a short emphasis), then a beat.
      script.push({ action: 'click', target: spec, path: (from) => ({ duration: 0, at: () => from }) })
      script.push({ action: 'wait', duration: CLICK_REST_MS })
    }
    if (mark.action === 'type' && mark.text) script.push({ action: 'type', target: markElement, text: mark.text })
  })
  if (!marks.length) {
    const path: CursorPath = (from, to) => {
      const plan = planPath(from, to, { center: centerIn(measurePointerOrigin()) })
      stampMove()
      return plan
    }
    // Where the arrow rests with the line (the outro): the middle of the screen when the line covers nothing there,
    // else the nearest open place — not over the home hero's 채린 and her bubble, its title or the cards (UX review 9-1).
    // Chosen once the line is drawn (its size), just before the move reads `rest`.
    const rest = { x: window.innerWidth / 2, y: window.innerHeight * 0.42, client: true }
    script.push({
      action: 'call',
      run: () => {
        const box = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
        const size = box && box.width ? { width: box.width, height: box.height } : { width: 200, height: 36 }
        const width = window.innerWidth, height = window.innerHeight
        const points = [[0.5, 0.42], [0.5, 0.6], [0.3, 0.75], [0.5, 0.75], [0.7, 0.75], [0.3, 0.62], [0.7, 0.62], [0.5, 0.25], [0.25, 0.3], [0.75, 0.3]]
          .map(([x, y]) => ({ x: Math.round(width * x!), y: Math.round(height * y!) }))
        const { tip, side } = chooseRestingPlace(points, size, avoidAround(null), preferredSide(step))
        rest.x = tip.x
        rest.y = tip.y
        place({ id: step.id, side, lift: 0, shift: labelShift(side, tip, size, width) })
      },
    })
    script.push({ action: 'move', to: rest, path }, sayIt)
  }
  // Long enough to read the line from when it showed.
  script.push({ action: 'call', run: () => sleep(Math.max(MIN_REST_MS, readMs(step.say) - (performance.now() - run.lineAt))) })
  if (next && next.screen === step.screen) script.push({ action: 'call', run: () => go(next, 1) })
  return { ...CURSOR, start, script }
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
        // Lit elements taken out of the page (the screen changed): the hole stays where it is until the next lightUp.
        if (this.lit.length && !this.lit.some((node) => node.isConnected)) return
        const box = this.lit.length ? spotOf(this.lit) : null
        // At rest the hole moves there at once; mid-move the move bends onto it (tour-spotlight.ts).
        if (this.lit.length) spotlight.follow(box)
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

  /**
   * Lights `elements` (with the cursor's move when `motion` is given) and follows them from now on. `aim`: their box
   * once a scroll that has just started ends (the move heads there, then bends onto where they are).
   */
  lightUp(elements: readonly Element[], motion: SpotMotion | null, aim: SpotRect | null = null) {
    this.lit = elements
    this.resize?.disconnect()
    for (const node of elements) this.resize?.observe(node)
    const box = aim ?? spotOf(elements)
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
