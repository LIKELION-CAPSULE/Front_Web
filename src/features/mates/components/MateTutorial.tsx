import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ShowcasePointer, type CursorConfig, type CursorStep } from '@/shared/ui/showcase-pointer/showcase-pointer'
import { Button } from '@/shared/ui/Button'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { mateAvatar } from '../artwork'
import { buildTourSteps, readMs } from './home-tour-steps'
import '../mate-tutorial.css'

/**
 * 홈 「사용법 보기」(`/?tutorial=1`, PRD H-3): a coach mark on the real home screen. One cursor named 「채린」 (Showcase
 * Pointer, src/shared/ui/showcase-pointer) points at each feature and says what it does, over a dimmed page with the
 * target lit (spotlight).
 *
 * - The script's click is a visual press only: `onCursorPress` changes local preview state. Nothing is clicked,
 *   submitted or navigated; no click / pointer / mouse down-up event is dispatched (the cursor's hover sends the usual
 *   synthetic hover events only).
 * - While it runs the app behind is inert (no clicks, keys or scrolling); the tour UI lives in a portal beside it.
 *   The dim layer and the cursor layer let pointers through.
 * - Skip any time (button or Esc). 「다음」 goes to the next step. At the end: 「메이트 만나러 가기」 closes the tour and
 *   scrolls to the mates, 「다시 보기」 replays. No loop.
 * - Reduced motion: no cursor or movement; each step lights its target and shows 채린's line beside it, paced by
 *   「다음」.
 * - Every step is announced through an `aria-live` region.
 */

const CHAERIN_COLOR = '#8053F2' // logo v2 violet (design/brand/capsule-logo-2026-11-22-v2)
const SPOT_PADDING = 8

function rectOf(element: Element | null) {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return { left: rect.left - SPOT_PADDING, top: rect.top - SPOT_PADDING, width: rect.width + SPOT_PADDING * 2, height: rect.height + SPOT_PADDING * 2 }
}

export function MateTutorial({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const reduced = useReducedMotion()
  const [run, setRun] = useState(0)
  const steps = useMemo(() => buildTourSteps(), [run]) // eslint-disable-line react-hooks/exhaustive-deps -- rebuilt for each replay
  const [index, setIndex] = useState(0)
  const [ended, setEnded] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [spot, setSpot] = useState<ReturnType<typeof rectOf>>(null)
  /** Just under 채린's line: where the press preview sits, so it never covers the page's own words. */
  const [lineBottom, setLineBottom] = useState<{ left: number; top: number } | null>(null)
  const step = ended ? null : steps[index] ?? null
  const panel = useRef<HTMLDivElement>(null)
  const meet = useRef<HTMLButtonElement>(null)

  const next = useCallback(() => {
    setPreview(null)
    setIndex((value) => {
      if (value + 1 >= steps.length) {
        setEnded(true)
        return value
      }
      return value + 1
    })
  }, [steps.length])

  // The app behind is inert and does not scroll while the tour runs; the tour scrolls it itself.
  useLayoutEffect(() => {
    const root = document.getElementById('root')
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    root?.setAttribute('inert', '')
    html.style.overflow = 'hidden'
    return () => {
      root?.removeAttribute('inert')
      html.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Scroll the target into view (reduced motion: here, at once; otherwise the cursor script does it).
  useEffect(() => {
    if (!reduced || !step?.target) return
    const element = step.target()
    if (step.scroll === 'top') window.scrollTo({ top: 0, behavior: 'instant' })
    else element?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [reduced, step])

  // The spotlight follows its target (scrolling, layout, the card's hover lift); the press preview follows 채린's line.
  useEffect(() => {
    let frame = 0
    const follow = () => {
      const label = document.querySelector('.home-tour-pointer .showcase-pointer-cursor-label')?.getBoundingClientRect()
      const below = label ? { left: Math.round(label.left), top: Math.round(label.bottom + 8) } : null
      setLineBottom((previous) => (previous?.left === below?.left && previous?.top === below?.top ? previous : below))
      const next = rectOf(step?.target?.() ?? null)
      setSpot((previous) =>
        previous && next && Math.abs(previous.left - next.left) < 0.5 && Math.abs(previous.top - next.top) < 0.5 &&
        Math.abs(previous.width - next.width) < 0.5 && Math.abs(previous.height - next.height) < 0.5
          ? previous
          : next,
      )
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [step])

  useEffect(() => {
    if (ended) meet.current?.focus({ preventScroll: true })
  }, [ended])
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[data-tour-skip]')?.focus({ preventScroll: true })
  }, [run])

  // One script per step: the cursor says the line, the page scrolls, the cursor hovers or visually presses the target,
  // then the step waits for the line to be read and moves on. Changing step restarts the script (the component cancels
  // the old one); the cursor carries on from the last target.
  const cursors: CursorConfig[] = useMemo(() => {
    if (reduced || !step) return []
    const target = step.target?.() ?? null
    const previous = index > 0 ? steps[index - 1]?.target?.() ?? null : null
    const script: CursorStep[] = []
    if (index === 0) script.push({ action: 'enter', at: { x: '50%', y: '78%' } })
    script.push({ action: 'say', text: step.say })
    if (target) {
      script.push({
        action: 'call',
        run: () => {
          if (step.scroll === 'top') window.scrollTo({ top: 0, behavior: 'smooth' })
          else target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        },
      })
      script.push({ action: 'wait', duration: 520 })
      // The arrow lands on an edge / lower corner of the target (`step.at`), never on its words.
      const spec = { target, ...step.at }
      script.push(step.action === 'click' ? { action: 'click', target: spec } : { action: 'hover', target: spec })
    } else {
      script.push({ action: 'move', to: { x: '50%', y: '44%' } })
    }
    script.push({ action: 'wait', duration: readMs(step.say) })
    script.push({ action: 'call', run: next })
    return [{
      id: 'chaerin',
      name: '채린',
      color: CHAERIN_COLOR,
      textColor: '#FFFFFF',
      start: index > 0 && previous ? { target: previous, ...steps[index - 1]?.at } : { x: '50%', y: '78%' },
      script,
    }]
  }, [reduced, step, index, steps, next])

  const live = ended
    ? '사용법을 다 봤어요. 메이트 만나러 가기 또는 다시 보기를 고를 수 있어요.'
    : step
      ? `${index + 1}/${steps.length}. 채린: ${step.say}`
      : ''

  return createPortal(
    <div className="home-tour" data-reduced={reduced || undefined}>
      <div className="home-tour-dim" data-spot={spot && !ended ? 'true' : undefined} aria-hidden="true"
        style={spot && !ended ? ({ '--spot-left': `${spot.left}px`, '--spot-top': `${spot.top}px`, '--spot-width': `${spot.width}px`, '--spot-height': `${spot.height}px` } as CSSProperties) : undefined} />

      {!reduced && !ended && (
        <ShowcasePointer
          cursors={cursors}
          loop={false}
          playing
          labelAnimation="fade"
          clickEffect
          className={`home-tour-pointer${step?.labelSide === 'left' ? ' home-tour-pointer--label-left' : ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', '--home-tour-avatar': `url("${mateAvatar('chaerin')}")` } as CSSProperties}
          onCycle={() => setPreview(null)}
          onCursorPress={() => setPreview(step?.id ?? null)}
        />
      )}

      {/* Visual press result: a local preview only (no connection starts). */}
      {preview === 'connect' && lineBottom && (
        <div className="home-tour-preview" style={{ left: lineBottom.left, top: lineBottom.top } as CSSProperties} aria-hidden="true">
          <span>영상통화처럼 함께</span>
          <span>음성 대화</span>
          <span>PIP로 띄우기</span>
        </div>
      )}

      {/* Reduced motion: 채린's line beside the lit target instead of a moving cursor. */}
      {reduced && step && (
        <div className="home-tour-line" aria-hidden="true"
          style={spot ? ({ left: Math.max(16, Math.min(spot.left, window.innerWidth - 336)), top: spot.top + spot.height + 12 } as CSSProperties) : undefined}>
          <img src={mateAvatar('chaerin')} alt="" width={24} height={24} />
          <span><b>채린</b>{step.say}</span>
        </div>
      )}

      <div ref={panel} className="home-tour-panel" role="dialog" aria-modal="true" aria-labelledby="home-tour-title">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{live}</p>
        {ended ? (
          <>
            <h2 id="home-tour-title" className="home-tour-title">이제 만나러 가 볼까요?</h2>
            <div className="home-tour-actions">
              <Button variant="ghost" size="sm" onClick={() => { setEnded(false); setIndex(0); setPreview(null); setRun((value) => value + 1) }}>다시 보기</Button>
              <Button ref={meet} size="sm" onClick={onComplete}>메이트 만나러 가기</Button>
            </div>
          </>
        ) : (
          <>
            <h2 id="home-tour-title" className="home-tour-title">캡슐 사용법 <span className="home-tour-count">{index + 1} / {steps.length}</span></h2>
            <div className="home-tour-actions">
              <Button variant="ghost" size="sm" data-tour-skip onClick={onClose}>건너뛰기</Button>
              <Button variant="secondary" size="sm" onClick={next}>다음</Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default MateTutorial
