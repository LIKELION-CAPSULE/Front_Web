import { useLayoutEffect, useRef, type FocusEvent, type PointerEvent } from 'react'

/**
 * Pointer / keyboard tilt of a capsule card (the collectible card material of capsule-card-effects.css): the stage
 * gets the rotation, light position and parallax shift as CSS variables and `data-active` while it is pointed at
 * (fine pointers only) or holds keyboard focus. Shared by the capsule card page (CapsuleCardSurface) and the record
 * card of a capsule (CapsuleRecordCard).
 */
export function paintCapsuleSurface(node: HTMLElement, x: number, y: number, active: 'pointer' | 'keyboard' | '') {
  const tilt = window.innerWidth < 700 ? 0.5 : 1
  node.style.setProperty('--capsule-rotate-x', `${(0.5 - y) * 10 * tilt}deg`)
  node.style.setProperty('--capsule-rotate-y', `${(x - 0.5) * 14 * tilt}deg`)
  node.style.setProperty('--capsule-light-x', `${x * 100}%`)
  node.style.setProperty('--capsule-light-y', `${y * 100}%`)
  node.style.setProperty('--capsule-shift-x', `${(x - 0.5) * 36}px`)
  node.style.setProperty('--capsule-shift-y', `${(y - 0.5) * 28}px`)
  node.dataset.active = active
}

/** The keyboard pose: lit from the upper right, as if a light caught the focused card. */
const KEYBOARD_POSE = { x: 0.56, y: 0.35 } as const

const hasKeyboardFocus = (node: HTMLElement) => node.matches(':focus-visible') || node.querySelector(':focus-visible') !== null

/**
 * Handlers for the stage element (`ref` goes on it). Off under reduced motion (the card rests flat and centred).
 * Focus anywhere inside the stage counts, so a card whose buttons take the focus tilts for the keyboard too.
 */
export function useCapsuleCardTilt<T extends HTMLElement>(reduced: boolean) {
  const ref = useRef<T>(null)
  const frame = useRef(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    if (reduced && ref.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      pointer.current = null
      paintCapsuleSurface(ref.current, 0.5, 0.5, '')
    }
    return () => cancelAnimationFrame(frame.current)
  }, [reduced])
  function reset() {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    pointer.current = null
    const node = ref.current
    if (!node) return
    if (!reduced && hasKeyboardFocus(node)) paintCapsuleSurface(node, KEYBOARD_POSE.x, KEYBOARD_POSE.y, 'keyboard')
    else paintCapsuleSurface(node, 0.5, 0.5, '')
  }
  return {
    ref,
    handlers: {
      onPointerMove(event: PointerEvent<T>) {
        if (reduced || event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
        const bounds = event.currentTarget.getBoundingClientRect()
        pointer.current = {
          x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
          y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
        }
        if (frame.current) return
        frame.current = requestAnimationFrame(() => {
          frame.current = 0
          if (ref.current && pointer.current) paintCapsuleSurface(ref.current, pointer.current.x, pointer.current.y, 'pointer')
        })
      },
      onPointerLeave: reset,
      onPointerCancel: reset,
      onFocus(event: FocusEvent<T>) {
        if (!reduced && !pointer.current && (event.target as Element).matches(':focus-visible')) {
          paintCapsuleSurface(event.currentTarget, KEYBOARD_POSE.x, KEYBOARD_POSE.y, 'keyboard')
        }
      },
      onBlur() {
        // Focus moving between two controls of the card: settle after the new focus lands.
        requestAnimationFrame(() => {
          if (!pointer.current) reset()
        })
      },
    },
  }
}
