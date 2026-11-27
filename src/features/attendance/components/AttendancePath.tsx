import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import roadArt from '@/assets/attendance/path/attendance-path-road.webp'
import capsuleArt from '@/assets/attendance/path/reward-capsule.webp'
import idleArt from '@/assets/attendance/path/chaerin-idle.webp'
import walkArt from '@/assets/attendance/path/chaerin-walk.webp'
import padData from '@/assets/attendance/path/pads.json'
import { MateDialogue } from '@/features/auth/login-variants/MateDialogue'
import { cn } from '@/shared/lib/cn'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { ATTENDANCE_PATH_LINES } from '../attendance-config'
import '../attendance-path.css'

type Pad = { day: number; x: number; y: number }
type Speech = { id: number; text: string }

/** Centre of each pad's top face, in % of the path art (top-left origin). Day 7 is the reward pad. */
const PADS: readonly Pad[] = padData.pads
const LAST = PADS.length - 1
/** The reward capsule's own layer, cut from the art at (1169, 14)–(1377, 258) of 1600×1000. */
const CAPSULE = { left: 73.0625, top: 1.4, width: 13, height: 24.4 } as const
/** Walking from one pad to the next. */
const WALK_MS = 900
/** Day 7: the capsule floats out from behind her, shakes with light, then bursts open into stars. */
const CAPSULE_MS = { out: 650, shake: 800, open: 450 } as const
/** Stars that fly out of the opened capsule. */
const SPARKS = Array.from({ length: 10 }, (_, index) => {
  const angle = (index / 10) * Math.PI * 2 - Math.PI / 2
  const distance = 7 + (index % 3) * 2.5
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.8, size: 0.9 + (index % 2) * 0.5 }
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** The pad the character stands on: the last day attended, or day 1 before the first check-in. */
const padFor = (streak: number) => PADS[clamp(streak - 1, 0, LAST)]!
const spot = (pad: Pad) => ({ left: `${pad.x}%`, top: `${pad.y}%` })
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** What she says where she stands: the day's line once it is reached, a nudge while today is still open. */
function lineFor(days: number, checkedInToday: boolean) {
  if (checkedInToday && days > 0) return ATTENDANCE_PATH_LINES.days[days - 1] ?? ATTENDANCE_PATH_LINES.days[LAST]!
  return days === 0 ? ATTENDANCE_PATH_LINES.start : ATTENDANCE_PATH_LINES.waiting
}

function characterLabel(streak: number) {
  return streak === 0 ? '1일차 발판에서 첫 출석을 기다리는 채린' : `${streak}일차 발판에 서 있는 채린`
}

/**
 * The hero's attendance path: seven pads on an isometric road, the reward capsule floating over day 7, and 채린
 * standing on the last day attended, saying the day's line over her head in the login screen's dialogue box. When `streak` goes up
 * by one she walks to the next pad; on day 7 the capsule opens and is gone for the rest of the week. Any other
 * change (first load, a new week) just puts her there. All motion is skipped under reduced motion.
 */
export function AttendancePath({ streak, checkedInToday, className }: {
  /** Days attended this week, 0–7. */
  streak: number
  checkedInToday: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const days = clamp(Math.trunc(streak) || 0, 0, PADS.length)
  const complete = days === PADS.length
  const walker = useRef<HTMLDivElement>(null)
  const hop = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLSpanElement>(null)
  const capsule = useRef<HTMLDivElement>(null)
  const capsuleImage = useRef<HTMLImageElement>(null)
  const burst = useRef<HTMLSpanElement>(null)
  const sparks = useRef<HTMLDivElement>(null)
  // The streak she is drawn at, so a +1 can be told apart from a load or a reset.
  const drawn = useRef(days)
  const checked = useRef(checkedInToday)
  const speechId = useRef(0)
  const [speech, setSpeech] = useState<Speech | null>(null)
  const [firstLine] = useState(() => lineFor(days, checkedInToday))

  const say = useCallback((text: string) => setSpeech({ id: ++speechId.current, text }), [])
  const endSpeech = useCallback((id: number) => setSpeech((current) => (current?.id === id ? null : current)), [])

  useLayoutEffect(() => {
    checked.current = checkedInToday
  }, [checkedInToday])

  // Her line for the day, shortly after the path appears.
  useEffect(() => {
    const timer = setTimeout(() => say(firstLine), 600)
    return () => clearTimeout(timer)
  }, [say, firstLine])

  // The pose lives on the DOM (data-pose) rather than in state: both images stay mounted and loaded, so the swap
  // never waits on a decode. The capsule likewise stays drawn while it opens (data-opening).
  useLayoutEffect(() => {
    const from = drawn.current
    drawn.current = days
    const root = walker.current
    if (from === days || !root) return
    const line = () => lineFor(days, checked.current)

    // A jump, a reset or reduced motion: she is simply there, and says the day's line.
    if (reduced || days !== from + 1) {
      const timer = setTimeout(() => say(line()), reduced ? 0 : 300)
      return () => clearTimeout(timer)
    }

    let live = true
    const running: Animation[] = []
    // The old line goes as she sets off; the new one comes when she gets there.
    const hush = setTimeout(() => setSpeech(null), 0)
    const play = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!element) return Promise.resolve()
      const animation = element.animate(keyframes, options)
      running.push(animation)
      return animation.finished.then(() => undefined, () => undefined)
    }
    const capsuleBox = capsule.current
    const opening = days === PADS.length
    if (opening && capsuleBox) capsuleBox.dataset.opening = ''

    const start = padFor(from)
    const end = padFor(days)
    const moving = start !== end
    if (moving) root.dataset.pose = 'walk'

    async function openCapsule() {
      const box = capsule.current
      const image = capsuleImage.current
      if (!box || !image) return
      // The glow colour is the capsule's resolved `color` (attendance-path.css), so it follows the tokens.
      const glow = getComputedStyle(box).color
      // Out from behind her into the open sky on her left, tilting as it goes.
      await play(box, [
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: 'translate(-100%, -8%) rotate(-10deg)' },
      ], { duration: CAPSULE_MS.out, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })
      if (!live) return
      // Something inside wants out: it shakes, and light leaks around it.
      await play(image, [
        { transform: 'rotate(0deg) scale(1)', filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
        { transform: 'rotate(-7deg) scale(1.03)', filter: `brightness(1.1) drop-shadow(0 0 8px ${glow})`, offset: 0.2 },
        { transform: 'rotate(6deg) scale(1.05)', filter: `brightness(1.2) drop-shadow(0 0 12px ${glow})`, offset: 0.4 },
        { transform: 'rotate(-5deg) scale(1.07)', filter: `brightness(1.3) drop-shadow(0 0 16px ${glow})`, offset: 0.6 },
        { transform: 'rotate(4deg) scale(1.09)', filter: `brightness(1.4) drop-shadow(0 0 20px ${glow})`, offset: 0.8 },
        { transform: 'rotate(0deg) scale(1.1)', filter: `brightness(1.5) drop-shadow(0 0 24px ${glow})` },
      ], { duration: CAPSULE_MS.shake, easing: 'ease-in-out', fill: 'forwards' })
      if (!live) return
      // It bursts open: a flash, stars flying out, and the capsule itself dissolving into the light.
      void play(burst.current, [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.3 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1.8)' },
      ], { duration: 1300, easing: 'ease-out' })
      for (const [index, star] of Array.from(sparks.current?.children ?? []).entries()) {
        const { x, y } = SPARKS[index]!
        void play(star, [
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)' },
          { opacity: 1, transform: `translate(calc(-50% + ${x * 0.4}cqw), calc(-50% + ${y * 0.4}cqw)) scale(1) rotate(40deg)`, offset: 0.25 },
          { opacity: 0, transform: `translate(calc(-50% + ${x}cqw), calc(-50% + ${y + 3}cqw)) scale(0.6) rotate(140deg)` },
        ], { duration: 1100 + (index % 3) * 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      }
      await play(image, [
        { transform: 'rotate(0deg) scale(1.1)', opacity: 1, filter: `brightness(1.5) drop-shadow(0 0 24px ${glow})` },
        { transform: 'rotate(0deg) scale(1.45)', opacity: 0, filter: `brightness(2.4) drop-shadow(0 0 32px ${glow})` },
      ], { duration: CAPSULE_MS.open, easing: 'ease-out', fill: 'forwards' })
      if (!live) return
      // Gone for the rest of the week: hide it, then drop the held frames so it is whole again next week.
      delete box.dataset.opening
      for (const animation of [...box.getAnimations(), ...image.getAnimations()]) {
        if (!(animation instanceof CSSAnimation)) animation.cancel()
      }
      await wait(350)
    }

    void Promise.all([
      moving ? play(root, [spot(start), spot(end)], { duration: WALK_MS, easing: 'ease-in-out' }) : null,
      // Two little hops on the way (one in place for day 1, whose pad she already stands on).
      play(hop.current, [
        { transform: 'translateY(0)', easing: 'ease-out' },
        { transform: 'translateY(-7%)', easing: 'ease-in' },
        { transform: 'translateY(0)', easing: 'ease-out' },
        { transform: 'translateY(-7%)', easing: 'ease-in' },
        { transform: 'translateY(0)' },
      ], { duration: WALK_MS }),
      play(shadow.current, [{ scale: '1' }, { scale: '0.82' }, { scale: '1' }, { scale: '0.82' }, { scale: '1' }], { duration: WALK_MS }),
    ]).then(async () => {
      if (!live) return
      delete root.dataset.pose
      if (opening) await openCapsule()
      if (live) say(line())
    })

    return () => {
      live = false
      clearTimeout(hush)
      for (const animation of running) animation.cancel()
      delete root.dataset.pose
      if (capsuleBox) delete capsuleBox.dataset.opening
    }
  }, [days, reduced, say])

  const label = characterLabel(days)
  const stand = padFor(days)
  // Keep the bubble inside the path and clear of the day 7 reward capsule (left: 73.06%) while the capsule is shown.
  const bubbleAlign =
    stand.x < 30
      ? 'start'
      : !complete && stand.x >= 70
        ? 'before-capsule'
        : !complete && stand.x >= 55
          ? 'left'
          : stand.x > 70
            ? 'end'
            : undefined

  return (
    <div className={cn('attendance-path', className)} data-complete={complete || undefined}>
      <img
        className="attendance-path-art"
        src={roadArt}
        width={1600}
        height={1000}
        alt={complete ? '7일 출석 길' : '7일 출석 길, 7일차 위에 보상 캡슐'}
        decoding="async"
        draggable={false}
      />

      <div className="attendance-path-pads" aria-hidden="true">
        {PADS.map((pad, index) => {
          const state = index < days ? 'done' : index === days && !checkedInToday ? 'today' : 'upcoming'
          return (
            <span
              key={pad.day}
              className="attendance-path-pad"
              data-state={state}
              data-reward={index === LAST || undefined}
              style={spot(pad) as CSSProperties}
            >
              <span className="attendance-path-day">{pad.day}일차</span>
              {state === 'done' && (
                <span className="attendance-path-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div
        ref={capsule}
        className="attendance-path-capsule"
        style={{ left: `${CAPSULE.left}%`, top: `${CAPSULE.top}%`, width: `${CAPSULE.width}%` }}
        aria-hidden="true"
      >
        <img ref={capsuleImage} src={capsuleArt} width={208} height={244} alt="" draggable={false} />
      </div>

      <div ref={walker} className="attendance-path-walker" data-bubble={bubbleAlign} style={spot(stand)}>
        <span ref={shadow} className="attendance-path-shadow" aria-hidden="true" />
        {/* Over her head, so it goes where she goes; it stays still while she breathes or hops. */}
        <div className="attendance-path-dialogue">
          {speech && (
            <MateDialogue
              key={speech.id}
              id={speech.id}
              name={ATTENDANCE_PATH_LINES.speaker}
              text={speech.text}
              reducedMotion={reduced}
              onDone={endSpeech}
            />
          )}
        </div>
        <div ref={hop} className="attendance-path-hop">
          <div className="attendance-path-breathe">
            <img className="attendance-path-pose" data-pose="idle" src={idleArt} width={357} height={600} alt={label} draggable={false} />
            <img className="attendance-path-pose" data-pose="walk" src={walkArt} width={431} height={600} alt={label} draggable={false} />
          </div>
        </div>
      </div>

      {/* Where the capsule opens: over the sky left of day 7, clear of her. */}
      <span ref={burst} className="attendance-path-burst" aria-hidden="true" />
      <div ref={sparks} className="attendance-path-sparks" aria-hidden="true">
        {SPARKS.map((spark, index) => (
          <span key={index} style={{ width: `${spark.size}cqw` }} />
        ))}
      </div>

      {/* The typed box is aria-hidden; screen readers hear the whole line once here. */}
      <p className="sr-only" aria-live="polite">{speech ? `${ATTENDANCE_PATH_LINES.speaker}: ${speech.text}` : ''}</p>
    </div>
  )
}
