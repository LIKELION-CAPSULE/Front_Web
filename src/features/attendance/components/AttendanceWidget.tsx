import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { animate, useReducedMotion, type AnimationPlaybackControls, type DOMKeyframesDefinition } from 'motion/react'
import {
  ATTENDANCE_COPY, ATTENDANCE_LAYOUTS, COMPACT_MEDIA, CYCLE_DAYS, MOTION, PAGE_EASE, SLOTS_PER_PAGE, type AttendanceLayout,
} from '../attendance-config'
import { characterSpot, fitLayout, pageCount, pageFor, pageOffset, pageStart, type CharacterPose } from '../attendance-model'
import { useAttendanceController } from '../attendance-controller'
import { creditTarget, landCreditReward } from '../credit-reward'
import { AttendanceDevPanel } from './AttendanceDevPanel'
import { AttendanceEffects, type AttendanceEffectsHandle } from './AttendanceEffects'
import { AttendanceTrack, type TrackView } from './AttendanceTrack'
import { CHARACTER_IMAGES } from './AttendanceCharacter'
import { SLOT_IMAGES } from './AttendanceSlot'
import '../attendance.css'

const ALL_IMAGES = [...Object.values(CHARACTER_IMAGES), ...Object.values(SLOT_IMAGES)]
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const STARS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 11) % 97}%`,
  top: `${(i * 53 + 7) % 89}%`,
  size: 1 + (i % 3),
  delay: `${-(i * 1.7) % 9}s`,
  duration: `${9 + (i % 5) * 2}s`,
}))

/** Runs a motion animation with `will-change` set only while it plays. */
function run(element: Element | null | undefined, keyframes: DOMKeyframesDefinition, options: Parameters<typeof animate>[2]) {
  if (!(element instanceof HTMLElement)) return Promise.resolve()
  element.style.willChange = 'transform, opacity'
  const controls = animate(element, keyframes, options) as AnimationPlaybackControls
  return controls.finished.then(() => { element.style.willChange = '' }, () => { element.style.willChange = '' })
}

/** Where each moved element was last put, so every animation starts from an explicit value. */
const positions = new WeakMap<HTMLElement, { x: number; y: number }>()
function place(element: HTMLElement | null, x: number, y = 0) {
  if (!element) return
  positions.set(element, { x, y })
  element.style.transform = `translate(${x}px, ${y}px)`
}
const positionOf = (element: HTMLElement | null) => (element && positions.get(element)) || { x: 0, y: 0 }

/** Slides the track to `x` from wherever it is now. */
function slideTrack(element: HTMLElement | null, x: number, seconds: number) {
  if (!element) return Promise.resolve()
  const from = positionOf(element).x
  positions.set(element, { x, y: 0 })
  return run(element, { x: [from, x] }, seconds ? { duration: seconds, ease: PAGE_EASE } : { duration: 0 })
}

/**
 * The attendance rewards widget for the home hero: seven days on platforms, the character standing on the last day
 * attended, and one continuous check-in sequence (jump, land, collect, coin, reward flight). It has no button of its
 * own: it hands the sequence to the attendance controller, and the hero CTA starts it.
 */
export function AttendanceWidget({ size = 'fit', visibleSlots = SLOTS_PER_PAGE, headingId }: {
  /** `fit` grows with the room it has; `compact` always uses the small set (e.g. inside a card row). */
  size?: 'fit' | 'compact'
  /** The id of a section title outside the widget (home): the inner 「출석 보상」 bubble is then left out. */
  headingId?: string
  /** Days visible at once; the pages slide by this many, the last one pulled back to stay full. */
  visibleSlots?: number
}) {
  const visible = visibleSlots
  const { state, checkIn, isLoading, devSet, register, setBusy } = useAttendanceController()
  const reduced = useReducedMotion() ?? false
  const root = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const character = useRef<HTMLDivElement>(null)
  const squash = useRef<HTMLDivElement>(null)
  const effects = useRef<AttendanceEffectsHandle>(null)
  const [layout, setLayout] = useState<AttendanceLayout>(ATTENDANCE_LAYOUTS.regular)
  const compact = layout.platformWidth < ATTENDANCE_LAYOUTS.regular.platformWidth
  const [assetsReady, setAssetsReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [pose, setPose] = useState<CharacterPose>('idle')
  // While a check-in plays, the sequence decides what shows; otherwise everything follows the loaded state.
  const [sequenceView, setView] = useState<TrackView | null>(null)
  const [sequencePage, setPage] = useState<number | null>(null)
  const [previewPage, setPreviewPage] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [flight, setFlight] = useState<{ amount: number } | null>(null)
  const flightRef = useRef<HTMLDivElement>(null)

  const busy = playing || requesting
  const view: TrackView = sequenceView ?? { cycleDay: state.cycleDay, checkedToday: state.checkedToday, characterIndex: state.cycleDay - 1, award: null }
  const page = sequencePage ?? pageFor(state.cycleDay, visible)

  // Every image is decoded before the widget shows, so no pose or award blinks the first time it is used.
  useEffect(() => {
    let alive = true
    Promise.all(ALL_IMAGES.map((src) => {
      const image = new Image()
      image.src = src
      return image.decode().catch(() => undefined)
    })).then(() => { if (alive) setAssetsReady(true) })
    return () => { alive = false }
  }, [])

  // The whole widget scales with the space it has: half the banner on desktop, the compact set on tablets.
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0
      const next = size === 'compact' ? ATTENDANCE_LAYOUTS.compact : fitLayout(width, window.matchMedia(COMPACT_MEDIA).matches)
      setLayout((current) => (current.scale === next.scale ? current : next))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [size])

  // Idle loops stop when the banner is off screen or the tab is hidden.
  useEffect(() => {
    const element = root.current
    if (!element) return
    let visible = true
    const update = () => setPaused(!visible || document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      update()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  // Resting positions. During a sequence the animations own these transforms.
  const shownPage = previewPage ?? page
  useLayoutEffect(() => {
    if (busy) return
    const spot = characterSpot(view.characterIndex, layout)
    place(character.current, spot.x, spot.y)
    if (previewPage === null) place(track.current, pageOffset(page, layout, visible))
  }, [view.characterIndex, layout, page, previewPage, busy, visible])

  const preview = useCallback((next: number) => {
    if (busy) return
    setPreviewPage(next === page ? null : next)
    void slideTrack(track.current, pageOffset(next, layout, visible), reduced ? 0 : MOTION.pageSlide / 1000)
  }, [busy, page, layout, reduced, visible])

  async function flyReward(amount: number, from: DOMRect | undefined) {
    const target = creditTarget()?.getBoundingClientRect()
    setFlight({ amount })
    await nextFrame()
    const element = flightRef.current
    if (!element || !from) {
      landCreditReward(amount)
      setFlight(null)
      return
    }
    const sx = from.left + from.width / 2
    const sy = from.top
    if (!target) {
      await run(element, { x: [sx, sx], y: [sy, sy - 56], opacity: [0, 1, 0], scale: [0.8, 1, 0.9] }, { duration: 0.9, ease: 'easeOut' })
    } else {
      const ex = target.left + target.width / 2
      const ey = target.top + target.height / 2
      // Up off the coin first, then a curve over to the header chip, shrinking as it arrives.
      await run(element, {
        x: [sx, sx + (ex - sx) * 0.18, ex],
        y: [sy, sy - 70, ey],
        scale: [0.7, 1.05, 0.42],
        opacity: [0, 1, 0.95],
      }, { duration: MOTION.rewardFlight / 1000, times: [0, 0.32, 1], ease: ['easeOut', [0.55, 0, 0.75, 0.6]] })
    }
    landCreditReward(amount)
    setFlight(null)
  }

  async function onCheckIn() {
    if (busy || isLoading || view.checkedToday) return
    setRequesting(true)
    let credit: number
    try {
      credit = (await checkIn()).credit
    } catch {
      setRequesting(false)
      return
    }
    // Playing takes over before requesting ends, so the freshly loaded state never jumps ahead of the sequence.
    const startView = view
    setView(startView)
    setPage(page)
    setPlaying(true)
    setRequesting(false)
    const previewing = previewPage !== null
    setPreviewPage(null)
    if (previewing) await slideTrack(track.current, pageOffset(page, layout, visible), reduced ? 0 : 0.35)
    const fromIndex = startView.characterIndex
    const toIndex = startView.cycleDay
    const toDay = toIndex + 1
    const milestone = state.rewards[toIndex]?.milestone ?? false
    const nextPage = pageFor(toDay, visible)
    const slot = () => root.current?.querySelector(`[data-slot="${toIndex}"]`)
    const finalView: TrackView = { cycleDay: toDay, checkedToday: true, characterIndex: toIndex, award: null }

    if (reduced) {
      await run(character.current, { opacity: [1, 0] }, { duration: MOTION.reducedFade / 1000, ease: 'easeOut' })
      setView(finalView)
      setPage(nextPage)
      const spot = characterSpot(toIndex, layout)
      place(track.current, pageOffset(nextPage, layout, visible))
      place(character.current, spot.x, spot.y)
      landCreditReward(credit)
      await run(character.current, { opacity: [0, 1] }, { duration: MOTION.reducedFade / 1000, ease: 'easeOut' })
      finish()
      return
    }

    const from = characterSpot(fromIndex, layout)
    const to = characterSpot(toIndex, layout)
    const peak = Math.min(from.y, to.y) - layout.jumpHeight
    const jumpSeconds = MOTION.jump / 1000

    // 1. Crouch, swapping to the jump pose part way through.
    void run(squash.current, { scaleY: 0.9, scaleX: 1.06 }, { duration: MOTION.crouch / 1000, ease: 'easeOut' })
    setTimeout(() => setPose('jump'), MOTION.crouch - MOTION.poseFade)
    await wait(MOTION.jumpStart)

    // 2. The jump, with the page sliding underneath when the next day is on the next page.
    if (nextPage !== page) void slideTrack(track.current, pageOffset(nextPage, layout, visible), MOTION.pageSlide / 1000)
    void run(squash.current, { scaleY: [0.9, 1.05, 1.02], scaleX: [1.06, 0.97, 0.99] }, { duration: jumpSeconds, times: [0, 0.4, 1], ease: 'easeOut' })
    const flightDone = run(character.current, {
      x: [from.x, to.x],
      y: [from.y, peak, to.y],
    }, {
      x: { duration: jumpSeconds, ease: [0.35, 0.1, 0.65, 0.9] },
      y: { duration: jumpSeconds, times: [0, 0.44, 1], ease: ['easeOut', 'easeIn'] },
    })
    await flightDone
    positions.set(character.current!, to)
    setPage(nextPage)

    // 3. Land: squash and a ring spreading from the platform; 4. the capsule flares and breaks into sparks.
    void run(squash.current, { scaleY: [0.92, 1], scaleX: [1.06, 1] }, { type: 'spring', stiffness: 400, damping: 18 })
    setPose('cheer')
    const target = slot()
    void run(target?.querySelector('.att-slot-ring'), { scale: [0.6, 1.6], opacity: [1, 0] }, { duration: MOTION.ring / 1000, ease: 'easeOut' })
    const capsule = target?.querySelector('.att-slot-capsule')
    const capsuleBox = capsule?.getBoundingClientRect()
    const host = root.current?.querySelector('.att-effects')?.getBoundingClientRect()
    // Gone by 70% so it is never cut off when the award replaces it.
    void run(capsule, { scale: [1, 1.25, 1.15, 1.1], opacity: [1, 1, 0, 0] }, { duration: MOTION.capsuleBurst / 1000, times: [0, 0.3, 0.7, 1], ease: 'easeOut' })
    setTimeout(() => {
      if (capsuleBox && host) effects.current?.burst(capsuleBox.left + capsuleBox.width / 2 - host.left, capsuleBox.top + capsuleBox.height / 2 - host.top)
    }, MOTION.capsuleBurst * 0.3)
    setTimeout(() => setPose('idle'), MOTION.cheer)

    // 5. The award pops onto the platform as the sparks fade.
    await wait(MOTION.coinDelay)
    setView({ ...finalView, award: { index: toIndex, phase: 'entering' } })
    await nextFrame()
    const award = slot()?.querySelector('.att-slot-award')
    const pop = award?.querySelector('.att-slot-award-pop')
    if (milestone) {
      void run(pop, { rotateY: [90, 0], scale: [0.4, 1], opacity: [0, 1] }, { rotateY: { type: 'spring', stiffness: 220, damping: 16 }, scale: { type: 'spring', stiffness: 320, damping: 15 }, opacity: { duration: 0.15 } })
      void run(award?.querySelector('.att-slot-rays'), { opacity: [0, 1, 0], rotate: [0, 50], scale: [0.7, 1.1, 1.15] }, { duration: MOTION.rays / 1000, times: [0, 0.25, 1], ease: 'easeOut' })
    } else {
      void run(pop, { scale: [0, 1.12, 1], rotate: [-8, 0], opacity: [0, 1] }, { scale: { type: 'spring', stiffness: 360, damping: 14 }, rotate: { type: 'spring', stiffness: 260, damping: 18 }, opacity: { duration: 0.12 } })
      setTimeout(() => void run(award?.querySelector('.att-slot-shine'), { x: ['-120%', '120%'] }, { duration: MOTION.shine / 1000, ease: [0.4, 0, 0.2, 1] }), 220)
    }

    // 9. The whole week done: confetti falls over the widget.
    if (toDay === CYCLE_DAYS) setTimeout(() => effects.current?.confetti(MOTION.confetti), MOTION.confettiDelay)

    // 6. The reward flies to the header, which counts up when it lands.
    await wait(MOTION.rewardDelay - 120)
    await flyReward(credit, award?.getBoundingClientRect())

    finish()
  }

  /** Hands control back to the loaded state, which by now matches what the sequence ended on. */
  function finish() {
    setView(null)
    setPage(null)
    setPose('idle')
    setPlaying(false)
  }

  // The hero CTA starts the sequence through the controller; it always runs the latest closure.
  const sequence = useRef(onCheckIn)
  useEffect(() => { sequence.current = onCheckIn })
  useEffect(() => {
    register(async () => {
      // Started from elsewhere (the hero CTA): bring the widget into view first so the show is not missed.
      const box = root.current?.getBoundingClientRect()
      if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
        root.current!.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
        if (!reduced) await wait(MOTION.scrollIntoView)
      }
      await sequence.current()
    })
    return () => register(null)
  }, [register, reduced])
  useEffect(() => { setBusy(busy) }, [busy, setBusy])

  const done = view.checkedToday
  return (
    <section
      ref={root}
      className="att-widget"
      aria-labelledby={headingId ?? 'attendance-title'}
      data-ready={assetsReady || undefined}
      data-paused={paused || undefined}
      data-playing={playing || undefined}
      data-compact={compact || undefined}
      style={{ '--att-scale': layout.scale } as CSSProperties}
    >
      <div className="att-stars" aria-hidden="true">
        {STARS.map((star, i) => (
          <span key={i} style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay, animationDuration: star.duration } as CSSProperties} />
        ))}
      </div>

      <div className="att-orbits" aria-hidden="true"><span /><span /></div>

      {!headingId && (
        <header className="att-header">
          <h2 id="attendance-title" className="att-bubble">
            <span className="att-sparkle" aria-hidden="true" />
            {ATTENDANCE_COPY.title}
          </h2>
        </header>
      )}

      <AttendanceTrack
        ref={viewport}
        view={view}
        rewards={state.rewards}
        pose={pose}
        layout={layout}
        visible={visible}
        trackRef={track}
        characterRef={character}
        squashRef={squash}
      />

      <footer className="att-footer">
        <div className="att-dots" role="group" aria-label="출석 페이지">
          {Array.from({ length: pageCount(visible) }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={ATTENDANCE_COPY.pageLabel(pageStart(i, visible) + 1, pageStart(i, visible) + visible)}
              aria-pressed={shownPage === i}
              disabled={busy}
              onClick={() => preview(i)}
            />
          ))}
        </div>
      </footer>

      <AttendanceEffects ref={effects} />
      {flight && createPortal(
        <div ref={flightRef} className="att-reward-flight" aria-hidden="true">{ATTENDANCE_COPY.reward(flight.amount)}</div>,
        document.body,
      )}
      <p className="sr-only" role="status">{done ? `${view.cycleDay}일차 출석을 완료했어요.` : ''}</p>
      {import.meta.env.DEV && <AttendanceDevPanel disabled={busy} cycleDay={state.cycleDay} checkedToday={state.checkedToday} onSet={devSet} />}
    </section>
  )
}
