import { useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { AvatarItem } from '@/shared/api/types'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import './avatar-dial.css'

const compactQuery = '(max-width: 767px)'
const compactSnapshot = () => window.matchMedia(compactQuery).matches
function subscribeCompact(notify: () => void) {
  const media = window.matchMedia(compactQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const wrap = (index: number, count: number) => count ? ((index % count) + count) % count : 0
function shortestDistance(distance: number, count: number) {
  if (!count) return 0
  const forward = wrap(distance, count)
  return forward > count / 2 ? forward - count : forward
}

function AvatarPortrait({ avatar, fallback }: { avatar?: AvatarItem; fallback: ReactNode }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return avatar?.thumbnailUrl && failedSource !== avatar.thumbnailUrl
    ? <img src={avatar.thumbnailUrl} alt="" className="avatar-dial-image" draggable={false} onError={() => setFailedSource(avatar.thumbnailUrl!)} />
    : fallback
}

function DialOption({ avatar, index, offset, edge, direction, checked, disabled, reduced, fallback, choose, navigate }: {
  avatar: AvatarItem & { id: number }
  index: number
  offset: number
  edge: number
  direction: number
  checked: boolean
  disabled: boolean
  reduced: boolean
  fallback: ReactNode
  choose: (index: number) => void
  navigate: (event: KeyboardEvent<HTMLInputElement>, index: number) => void
}) {
  const present = useIsPresent()
  return <motion.label
    title={avatar.name}
    className="avatar-dial-hole"
    aria-hidden={!present || undefined}
    inert={!present}
    style={{ '--dial-position': offset, zIndex: checked ? 2 : 1 } as CSSProperties}
    initial={reduced ? false : { '--dial-position': direction * edge, opacity: 0 }}
    animate={{ '--dial-position': offset, opacity: 1 }}
    exit="leave"
    variants={{ leave: (travel: number) => ({ '--dial-position': -travel * edge, opacity: 0 }) }}
    transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
  >
    <input className="sr-only" type="radio" name="onboardingAvatar" value={avatar.id} aria-label={avatar.name || `아바타 ${index + 1}`} checked={checked && present} disabled={disabled || !present} tabIndex={checked && present ? 0 : -1} onChange={() => choose(index)} onKeyDown={event => navigate(event, index)} />
    <span className="avatar-dial-thumbnail"><AvatarPortrait avatar={avatar} fallback={fallback} /></span>
  </motion.label>
}

export function AvatarDial({ avatars, value, onChange, disabled = false, compact: forceCompact = false, fallback }: {
  avatars: readonly AvatarItem[]
  value?: number
  onChange: (id: number) => void
  disabled?: boolean
  compact?: boolean
  fallback: ReactNode
}) {
  const viewportCompact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => true)
  const compact = forceCompact || viewportCompact
  const reduced = useReducedMotion()
  const choices = avatars.filter((avatar): avatar is AvatarItem & { id: number } => typeof avatar.id === 'number')
  const selectedIndex = Math.max(0, choices.findIndex(avatar => avatar.id === value))
  const selected = choices[selectedIndex]
  // Keep an unbounded position so wrapping from the last avatar to the first slides one step.
  const [anchor, setAnchor] = useState(selectedIndex)
  const [direction, setDirection] = useState(1)
  const center = anchor + shortestDistance(selectedIndex - wrap(anchor, choices.length), choices.length)
  const capacity = compact ? 5 : 7
  const visibleCount = Math.min(choices.length, capacity)
  const leftCount = Math.floor((visibleCount - 1) / 2)
  const slots = Array.from({ length: visibleCount }, (_, index) => center - leftCount + index)
  const root = useRef<HTMLFieldSetElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  const hintId = useId()
  const selectedName = selected?.name || '기본 아바타'

  function choose(index: number, focus = false) {
    if (disabled || !choices.length) return
    const travel = shortestDistance(index - selectedIndex, choices.length)
    if (travel) setDirection(Math.sign(travel))
    setAnchor(center + travel)
    onChange(choices[index]!.id)
    if (focus) requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('input:checked:not(:disabled)')?.focus({ preventScroll: true }))
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = wrap(index + 1, choices.length)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = wrap(index - 1, choices.length)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = choices.length - 1
    else return
    event.preventDefault()
    choose(next, true)
  }
  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (disabled || choices.length < 2 || !event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }
  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (!start.dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      start.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  function endGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId || !start.dragging) return
    suppressClick.current = true
    const dx = event.clientX - start.x
    if (Math.abs(dx) >= 36) choose(wrap(selectedIndex + (dx < 0 ? 1 : -1), choices.length), true)
  }

  return <fieldset ref={root} disabled={disabled} className="avatar-dial" aria-describedby={choices.length > 1 ? hintId : undefined}>
    <legend className="sr-only">내 아바타 선택</legend>
    {choices.length > 1 && <p id={hintId} className="sr-only">아바타를 선택하면 중앙으로 이동해요. 좌우로 밀거나 방향키로 다른 아바타를 선택할 수 있어요.</p>}
    <div className="avatar-dial-stage" data-draggable={!disabled && choices.length > 1 || undefined}
      onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false } }}>
      <figure className="avatar-dial-preview" aria-label={`${selectedName} 미리보기`}>
        <div className="avatar-dial-portrait"><AvatarPortrait avatar={selected} fallback={fallback} /></div>
        <figcaption title={selectedName}>{selectedName}</figcaption>
      </figure>
      {!!slots.length && <div className="avatar-dial-orbit" aria-hidden="true" />}
      <AnimatePresence initial={false} custom={direction}>
        {slots.map(slot => {
          const index = wrap(slot, choices.length)
          const avatar = choices[index]!
          return <DialOption key={`${slot}:${avatar.id}`} avatar={avatar} index={index} offset={slot - center} edge={(capacity + 1) / 2} direction={direction} checked={avatar.id === selected?.id} disabled={disabled} reduced={reduced} fallback={fallback} choose={choose} navigate={navigate} />
        })}
      </AnimatePresence>
      {!choices.length && <p className="avatar-dial-empty">선택할 수 있는 아바타가 없어요.</p>}
    </div>
  </fieldset>
}
