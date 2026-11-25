import type { CSSProperties } from 'react'

/**
 * Gold lettering for the milestone badge: a dark brown outline underneath and a gradient fill on top, drawn as two
 * layers because browsers paint a text stroke over a clipped gradient fill and dull it.
 */
export function GoldText({ children, className, style }: { children: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`att-gold ${className ?? ''}`} style={style}>
      <span className="att-gold-stroke" aria-hidden="true">{children}</span>
      <span className="att-gold-fill">{children}</span>
    </span>
  )
}
