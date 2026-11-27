import type { CSSProperties } from 'react'
import type { MateAgeRating } from '../catalog'

/** What the rating mark says, in the style of the rating boards' marks (ALL · 15 · 19). */
const RATING_MARK: Readonly<Record<MateAgeRating, string>> = { all: 'ALL', 15: '15', adult: '19' }

/**
 * The age rating as a mark: a coloured square with ALL / 15 / 19, like a film rating. Decorative: the rating's name
 * is written beside it.
 */
export function AgeRatingMark({ rating }: { rating: MateAgeRating }) {
  return (
    <span className="mate-age-mark" data-rating={rating} aria-hidden="true">
      {RATING_MARK[rating]}
    </span>
  )
}

/** A voice: seven rounded bars, tallest second from each end, shortest in the middle. Sized like `Icon`. */
export function VoiceWaveIcon({ size = 20 }: { size?: number }) {
  // Bar centres and half-heights on a 24 grid, mirrored around the middle bar.
  const bars = [[3, 2.75], [6, 9.25], [9, 4.25], [12, 1.75], [15, 4.25], [18, 9.25], [21, 2.75]] as const
  return (
    <span className="app-icon" aria-hidden="true" style={{ '--icon-size': `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        {bars.map(([x, half]) => <line key={x} x1={x} y1={12 - half} x2={x} y2={12 + half} />)}
      </svg>
    </span>
  )
}
