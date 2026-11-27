import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { StageDialogueBox } from './StageDialogueBox'
import { dialogueCapacity, dialogueHold, dialoguePages, letterPace, type StageLine } from '../call-dialogue'
import '../call-dialogue.css'

/**
 * The call stage's dialogue box (C1 「대사창」, call UI step 2, 2026-11-27): a game dialogue box low on the stage, over
 * the dock, shown whether the chat is open or closed. Her name tag (and 「말하는 중」 while her mouth moves or her
 * voice plays) sits on its dithered roof; stepped pixel corners (DESIGN_SYSTEM: modals + this box only).
 *
 * - A line types at the chat's letter pace, in pages of two or three lines. The ▼ button (Enter / Space), or a click
 *   anywhere on the box, shows the page at once, then turns it; past the last page the box closes.
 * - A page holds long enough to read; after the last one the box stays a few seconds (longer while `linger`: her voice
 *   still plays) and leaves. A new line (a new `line.key`) replaces it at once. A reply that streams in keeps typing
 *   from where it was.
 * - `waiting` with no line: the box with her name and three dots (her reply is on its way).
 * - Screen readers: the drawn text is `aria-hidden` (the chat log is the live region). `announce` is read once through
 *   the slot's own polite region — for lines the log does not hold (event lines, or replies while the chat is closed).
 * - Reduced motion: no typing, no entrance; pages still turn.
 *
 * The slot stays mounted (its width sets the page size; it takes the focus back when the box leaves under it). `above`
 * is stacked over the box in the same column (누르고 말하기's heard text), so the two never overlap.
 */
export function CallDialogueBox({ name, line, waiting = false, speaking, linger = false, persist = false, announce = '', above, onTypingChange, onDone, tour }: {
  name: string
  line: StageLine | null
  waiting?: boolean
  speaking: boolean
  /** Keep the last page up while this is on (her voice still playing). */
  linger?: boolean
  /** Never leave by itself (the practice call). */
  persist?: boolean
  announce?: string
  above?: ReactNode
  onTypingChange?: (typing: boolean) => void
  onDone?: (key: string) => void
  /** `data-tour` of the box (practice call: a subject the tour's line keeps clear of). */
  tour?: string
}) {
  const slot = useRef<HTMLDivElement>(null)
  const [capacity, setCapacity] = useState(46)
  // The box steps in only when it appears from nothing; a line that follows 「답장 준비 중」 or another line takes the
  // box's place without coming in again.
  const showing = line ? `line:${line.key}` : waiting ? 'waiting' : null
  const [shown, setShown] = useState(showing)
  const [calm, setCalm] = useState(false)
  if (showing !== shown) {
    setShown(showing)
    setCalm(shown !== null && showing !== null)
  }
  useLayoutEffect(() => {
    const node = slot.current
    if (!node) return
    const measure = () => setCapacity(dialogueCapacity(node.clientWidth))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={slot} className="call-dialogue-slot" tabIndex={-1}>
      {above}
      {line ? (
        <DialogueBox
          key={line.key}
          lineKey={line.key}
          name={name}
          text={line.text}
          capacity={capacity}
          speaking={speaking}
          linger={linger}
          persist={persist}
          slot={slot}
          calm={calm}
          onTypingChange={onTypingChange}
          onDone={onDone}
          tour={tour}
        />
      ) : waiting ? (
        <StageDialogueBox name={name} data-phase="waiting" data-calm={calm || undefined} aria-hidden="true">
          <span className="call-dialogue-dots"><span /><span /><span /></span>
        </StageDialogueBox>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  )
}

function SpeakingMark() {
  return <span className="call-dialogue-speaking"><span className="call-dialogue-sep" /><span className="call-dialogue-bars"><span /><span /><span /></span>말하는 중</span>
}

type Phase = 'typing' | 'shown' | 'leaving'

function DialogueBox({ lineKey, name, text, capacity, speaking, linger, persist, slot, calm, onTypingChange, onDone, tour }: {
  lineKey: string
  name: string
  text: string
  capacity: number
  speaking: boolean
  linger: boolean
  persist: boolean
  slot: RefObject<HTMLDivElement | null>
  calm: boolean
  onTypingChange?: (typing: boolean) => void
  onDone?: (key: string) => void
  tour?: string
}) {
  const reduced = useReducedMotion()
  const pages = useMemo(() => dialoguePages(text, capacity), [text, capacity])
  const [pageState, setPage] = useState(0)
  // A repaging (resize, chat opened or closed) can leave fewer pages: stay on the last one.
  const page = Math.min(pageState, pages.length - 1)
  const pageText = pages[page] ?? ''
  const last = page >= pages.length - 1
  const pace = letterPace(text)
  const [phase, setPhase] = useState<Phase>('typing')
  /** Waited past the last page's hold while `linger` was on: leaves once it goes off. */
  const [held, setHeld] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const typed = useRef<HTMLSpanElement>(null)
  /** The page's text already on screen (a reply that grows keeps typing from there). */
  const shown = useRef('')
  const action = useRef<() => void>(() => {})
  const lingerRef = useRef(linger)
  const report = useRef(onTypingChange)
  const leave = useRef(() => {})
  useLayoutEffect(() => {
    lingerRef.current = linger
    report.current = onTypingChange
    leave.current = () => {
      setPhase('leaving')
      window.setTimeout(() => {
        // The focus was on its ▼: keep it in the stage rather than on the page's body.
        if (box.current?.contains(document.activeElement)) slot.current?.focus({ preventScroll: true })
        onDone?.(lineKey)
      }, reduced ? 0 : 200)
    }
  })

  // The mouth and 「말하는 중」 follow the letters: on while a page types, off when it is shown or the box goes.
  const typingNow = phase === 'typing' && !reduced
  useEffect(() => {
    if (!typingNow) return
    report.current?.(true)
    return () => report.current?.(false)
  }, [typingNow])

  useEffect(() => {
    if (!held || linger) return
    const timer = window.setTimeout(() => leave.current(), 1200)
    return () => clearTimeout(timer)
  }, [held, linger])

  useEffect(() => {
    const node = typed.current
    if (!node) return
    const letters = Array.from(pageText)
    const before = shown.current
    // Grown (streaming): type on from what is shown. Shrunk or replaced: what is shown stays a prefix, or starts over.
    const from = pageText.startsWith(before) ? Array.from(before).length : before.startsWith(pageText) ? letters.length : 0
    let frame = 0
    let state: 'typing' | 'shown' = 'typing'
    const waits: number[] = []
    const wait = (ms: number, run: () => void) => { waits.push(window.setTimeout(run, ms)) }
    // `asked`: the user turned it (▼ / click), so the last page closes even while her voice still plays.
    const next = (asked = false) => {
      if (!last) { shown.current = ''; setPhase('typing'); setPage(page + 1); return }
      if (persist && !asked) return
      if (lingerRef.current && !asked) setHeld(true)
      else leave.current()
    }
    const finish = () => {
      cancelAnimationFrame(frame)
      node.textContent = pageText
      shown.current = pageText
      state = 'shown'
      setPhase('shown')
      wait(dialogueHold(letters.length, last), () => next())
    }
    action.current = () => {
      for (const id of waits.splice(0)) clearTimeout(id)
      if (state === 'typing') finish()
      else next(true)
    }
    if (reduced || from >= letters.length) { node.textContent = pageText; frame = requestAnimationFrame(finish) }
    else {
      node.textContent = letters.slice(0, from).join('')
      let start = 0
      let count = from
      const tick = (now: number) => {
        if (!start) { start = now; setPhase('typing') }
        const visible = Math.min(letters.length, from + Math.floor((now - start) / pace) + 1)
        if (visible !== count) {
          node.textContent = letters.slice(0, visible).join('')
          shown.current = node.textContent
          count = visible
        }
        if (visible < letters.length) frame = requestAnimationFrame(tick)
        else finish()
      }
      frame = requestAnimationFrame(tick)
    }
    return () => { cancelAnimationFrame(frame); for (const id of waits) clearTimeout(id) }
  }, [page, pageText, last, pace, reduced, persist])

  const more = !last && phase === 'shown'
  return (
    // The whole box takes a click (show the page / turn it); the ▼ button is its keyboard way (its click bubbles here).
    <StageDialogueBox
      boxRef={box}
      name={name}
      nameExtras={speaking && <SpeakingMark />}
      hideTextFromSR
      data-phase={phase}
      data-calm={calm || undefined}
      data-tour={tour}
      onClick={() => action.current()}
      footer={(
        <button type="button" className="call-dialogue-next" data-more={more || undefined}>
          <span className="sr-only">{phase === 'typing' ? '대사 바로 보기' : last ? '대사창 닫기' : '다음 대사'}</span>
          <span className="call-dialogue-arrow" aria-hidden="true" />
        </button>
      )}
    >
      {/* The page's full text keeps the box at its final size while it types. */}
      <span className="call-dialogue-measure">{pageText}</span>
      <span ref={typed} className="call-dialogue-typed" />
    </StageDialogueBox>
  )
}
