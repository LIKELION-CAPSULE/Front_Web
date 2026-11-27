import type { RefObject } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { useScrollHint } from '@/shared/lib/use-scroll-hint'
import { Icon } from './Icon'
import './scroll-more-hint.css'

/**
 * A scroll area's 「아래로 더 있어요」 sign (UX review 1-4 · 7-2): a small pill at the bottom of the area while content is
 * hidden below, with the area's own bottom fade (`data-more-below`). A click scrolls one step down; it is not a tab stop
 * and screen readers skip it (the fields below are reached by Tab, which scrolls them into view). Place it in a
 * positioned box around the area; it sits at that box's bottom centre.
 */
export function ScrollMoreHint({ target, label = '아래로 더 있어요' }: { target: RefObject<HTMLElement | null>; label?: string }) {
  const { below } = useScrollHint(target)
  const reduced = useReducedMotion()
  if (!below) return null
  return (
    <button
      type="button"
      className="scroll-more-hint"
      tabIndex={-1}
      aria-hidden="true"
      data-scroll-more-hint
      onClick={() => {
        const node = target.current
        node?.scrollBy({ top: Math.round(node.clientHeight * 0.7), behavior: reduced ? 'auto' : 'smooth' })
      }}
    >
      <span>{label}</span>
      <Icon name="chevron" size={14} className="scroll-more-hint-icon" />
    </button>
  )
}
