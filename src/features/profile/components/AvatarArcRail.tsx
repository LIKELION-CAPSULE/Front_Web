import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { AvatarItem } from '@/shared/api/types'

/**
 * Onboarding's avatar row as a vertical arc at the left edge of the screen (the pre-spec dial of e833555^, turned on its
 * side): round stills on an arc whose centre lies off screen to the left, so it bulges into the page; the choice sits
 * in the middle of the arc (vertical centre), largest, and the others shrink and fade towards the ends.
 *
 * - Kept from the old dial: the unbounded anchor and shortest-way rotation (the last → the first slides one step),
 *   slots entering / leaving at the ends of the arc, the arc as a thin line.
 * - Choose with ↑ ↓ (and ← →, Home, End), the wheel (one step per notch), a vertical drag, or a click.
 * - Reduced motion: no sliding (positions change at once).
 * Placement is CSS (`--arc` per still; avatar-dial.css): top = centre + R·sin(arc·step), left = bulge − R·(1 − cos).
 */

const wrap = (index: number, count: number) => (count ? ((index % count) + count) % count : 0)
function shortestDistance(distance: number, count: number) {
  if (!count) return 0
  const forward = wrap(distance, count)
  return forward > count / 2 ? forward - count : forward
}
/** Slots shown around the choice (all of them when there are this many or fewer). */
const CAPACITY = 7

type Choice = AvatarItem & { id: number }

function ArcOption({ avatar, index, offset, edge, checked, disabled, reduced, name, portrait, onChoose, onKey }: {
  avatar: Choice
  index: number
  offset: number
  edge: number
  checked: boolean
  disabled: boolean
  reduced: boolean
  name: string
  portrait: ReactNode
  onChoose: (index: number) => void
  onKey: (event: KeyboardEvent<HTMLInputElement>, index: number) => void
}) {
  const present = useIsPresent()
  return (
    <motion.label
      title={avatar.name}
      className="avatar-arc-option"
      data-checked={checked || undefined}
      aria-hidden={!present || undefined}
      inert={!present}
      style={{ '--arc': offset, zIndex: checked ? 3 : 2 - Math.min(2, Math.abs(Math.round(offset))) } as CSSProperties}
      initial={reduced ? false : 'enter'}
      animate={{ '--arc': offset, opacity: 1 }}
      exit="leave"
      variants={{
        enter: (travel: number) => ({ '--arc': Math.sign(travel || 1) * edge, opacity: 0 }),
        leave: (travel: number) => ({ '--arc': -Math.sign(travel || 1) * edge, opacity: 0 }),
      }}
      transition={{ duration: reduced ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
    >
      <input
        className="sr-only"
        type="radio"
        name={name}
        value={avatar.id}
        aria-label={avatar.name || `아바타 ${index + 1}`}
        checked={checked && present}
        disabled={disabled || !present}
        tabIndex={checked && present ? 0 : -1}
        onChange={() => onChoose(index)}
        onKeyDown={(event) => onKey(event, index)}
      />
      <span className="avatar-arc-thumb">{portrait}</span>
    </motion.label>
  )
}

export function AvatarArcRail({ choices, selectedIndex, disabled, reduced, name, portraitOf, onChoose }: {
  choices: readonly Choice[]
  selectedIndex: number
  disabled: boolean
  reduced: boolean
  /** The radio group's name. */
  name: string
  portraitOf: (avatar: Choice) => ReactNode
  /** Choose an avatar by index (`focus`: move the keyboard focus to it). */
  onChoose: (index: number, focus?: boolean) => void
}) {
  const count = choices.length
  // An unbounded position, so wrapping from the last avatar to the first slides one step.
  const [anchor, setAnchor] = useState(selectedIndex)
  const [travel, setTravel] = useState(1)
  const center = anchor + shortestDistance(selectedIndex - wrap(anchor, count), count)
  const visible = Math.min(count, CAPACITY)
  const before = Math.floor((visible - 1) / 2)
  const slots = Array.from({ length: visible }, (_, index) => center - before + index)
  const edge = before + 1.4
  const root = useRef<HTMLDivElement>(null)

  function step(to: number, focus = false) {
    if (disabled || !count) return
    const target = wrap(to, count)
    const distance = shortestDistance(target - selectedIndex, count)
    if (distance) setTravel(Math.sign(distance))
    setAnchor(center + distance)
    onChoose(target, focus)
  }
  function onKey(event: KeyboardEvent<HTMLInputElement>, index: number) {
    let next: number
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else return
    event.preventDefault()
    step(next, true)
  }

  // The wheel: one step per notch (a trackpad's stream of small deltas adds up to a notch), never scrolling the page.
  const stepRef = useRef(step)
  const selectedRef = useRef(selectedIndex)
  useEffect(() => {
    stepRef.current = step
    selectedRef.current = selectedIndex
  })
  useEffect(() => {
    const node = root.current
    if (!node) return
    let sum = 0
    let last = 0
    const onWheel = (event: WheelEvent) => {
      if (disabled || count < 2) return
      event.preventDefault()
      const now = performance.now()
      if (now - last > 260) sum = 0
      sum += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (Math.abs(sum) < 40 || now - last < 180) return
      last = now
      const direction = Math.sign(sum)
      sum = 0
      stepRef.current(selectedRef.current + direction)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [disabled, count])

  // A vertical drag: one step per 64px.
  const gesture = useRef<{ id: number; y: number; stepped: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  const drag = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (disabled || count < 2 || !event.isPrimary || event.button !== 0) return
      suppressClick.current = false
      gesture.current = { id: event.pointerId, y: event.clientY, stepped: 0, dragging: false }
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const start = gesture.current
      if (!start || start.id !== event.pointerId) return
      const dy = event.clientY - start.y
      if (!start.dragging && Math.abs(dy) > 10) {
        start.dragging = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (!start.dragging) return
      const steps = Math.trunc(-dy / 64)
      if (steps !== start.stepped) {
        stepRef.current(selectedRef.current + (steps - start.stepped))
        start.stepped = steps
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const start = gesture.current
      gesture.current = null
      if (start?.dragging && start.id === event.pointerId) suppressClick.current = true
    },
    onPointerCancel() { gesture.current = null },
    onClickCapture(event: MouseEvent) {
      if (!suppressClick.current) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = false
    },
  }

  return (
    <div ref={root} className="avatar-arc" data-draggable={(!disabled && count > 1) || undefined} {...drag}>
      <div className="avatar-arc-line" aria-hidden="true" />
      <AnimatePresence initial={false} custom={travel}>
        {slots.map((slot) => {
          const index = wrap(slot, count)
          const avatar = choices[index]!
          return (
            <ArcOption
              key={slot}
              avatar={avatar}
              index={index}
              offset={slot - center}
              edge={edge}
              checked={index === selectedIndex && slot === center}
              disabled={disabled}
              reduced={reduced}
              name={name}
              portrait={portraitOf(avatar)}
              onChoose={(chosen) => step(chosen, false)}
              onKey={onKey}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}
