import { useEffect, useRef, type CSSProperties } from 'react'
import dome from '@/assets/invite/invite-dome.webp'
import capsule from '@/assets/invite/invite-capsule.webp'
import mascotLeft from '@/assets/invite/invite-mascot-left.webp'
import mascotRight from '@/assets/invite/invite-mascot-right.webp'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'

/** Centres of the dome's ten slots, in % of the dome art (840×891): two rows of five, filled left to right. */
const SLOT_X = [29.5, 40.2, 50.8, 61.5, 72.1] as const
const SLOT_Y = [38.1, 56.4] as const
/** Time between two capsules dropping in, here and in the progress strip. */
export const CAPSULE_STAGGER_MS = 140
/** Sparkles and hearts that burst over the mascots when a friend joins. */
const CHEER_BITS = [
  { x: 14, y: 22, kind: 'star' }, { x: 6, y: 40, kind: 'heart' }, { x: 26, y: 12, kind: 'star' },
  { x: 86, y: 18, kind: 'heart' }, { x: 94, y: 36, kind: 'star' }, { x: 76, y: 10, kind: 'star' },
] as const

/**
 * 친구 초대 hero art: the capsule dome with a capsule per invited friend (up to ten) and the two mascots. Capsules from
 * `enterFrom` on drop into their slots one after another; each new `cheer` makes the mascots jump for joy. Decorative:
 * the count is written out beside it.
 */
export function InviteHeroArt({ filled, enterFrom, cheer }: {
  /** Capsules in the dome, 0–10. */
  filled: number
  /** The first capsule that drops in (the ones before it are already there). */
  enterFrom: number
  /** Goes up by one each time a friend joins or a code is redeemed on this page. */
  cheer: number
}) {
  const reduced = useReducedMotion()
  const left = useRef<HTMLImageElement>(null)
  const right = useRef<HTMLImageElement>(null)
  const bits = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cheer || reduced) return
    const hop = (element: HTMLElement | null, delay: number, tilt: number) => element?.animate([
      { transform: 'translateY(0) rotate(0deg) scale(1)' },
      { transform: `translateY(4%) rotate(0deg) scale(1.04, 0.94)`, offset: 0.12 },
      { transform: `translateY(-18%) rotate(${tilt}deg) scale(0.97, 1.04)`, offset: 0.36 },
      { transform: 'translateY(0) rotate(0deg) scale(1.03, 0.96)', offset: 0.58 },
      { transform: `translateY(-8%) rotate(${-tilt / 2}deg) scale(1)`, offset: 0.76 },
      { transform: 'translateY(0) rotate(0deg) scale(1)' },
    ], { duration: 1100, delay, easing: 'ease-in-out' })
    const running = [hop(left.current, 0, -8), hop(right.current, 140, 8)]
    for (const [index, bit] of Array.from(bits.current?.children ?? []).entries()) {
      running.push(bit.animate([
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.2)' },
        { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.35 },
        { opacity: 0, transform: 'translate(-50%, -220%) scale(0.8)' },
      ], { duration: 1200, delay: 200 + (index % 3) * 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }))
    }
    return () => {
      for (const animation of running) animation?.cancel()
    }
  }, [cheer, reduced])

  return (
    <div className="invite-art" aria-hidden="true">
      <span className="invite-art-glow" />
      <div className="invite-dome">
        <img src={dome} width={840} height={891} alt="" draggable={false} />
        {SLOT_Y.flatMap((y, row) => SLOT_X.map((x, column) => {
          const index = row * SLOT_X.length + column
          if (index >= filled) return null
          return (
            <img
              key={index}
              className="invite-dome-capsule"
              src={capsule}
              width={120}
              height={236}
              alt=""
              draggable={false}
              data-enter={index >= enterFrom || undefined}
              style={{ left: `${x}%`, top: `${y}%`, '--enter-delay': `${(index - enterFrom) * CAPSULE_STAGGER_MS}ms` } as CSSProperties}
            />
          )
        }))}
      </div>
      <div className="invite-mascot invite-mascot--left">
        <img ref={left} src={mascotLeft} width={400} height={504} alt="" draggable={false} />
      </div>
      <div className="invite-mascot invite-mascot--right">
        <img ref={right} src={mascotRight} width={400} height={504} alt="" draggable={false} />
      </div>
      <div ref={bits} className="invite-cheer">
        {CHEER_BITS.map((bit, index) => (
          <span key={index} data-kind={bit.kind} style={{ left: `${bit.x}%`, top: `${bit.y}%` }} />
        ))}
      </div>
    </div>
  )
}
