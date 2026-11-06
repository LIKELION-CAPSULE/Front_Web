import gsap from 'gsap'
import type { CardQuad } from './capsule-intro-scene'

type Reveal = {
  root: HTMLElement
  flipper: HTMLElement
  /** The controls panel beside the card. */
  panel?: HTMLElement | null
  onComplete: () => void
}

/**
 * "Turn in from the side": the finished card appears tiny at the screen center (where the capsule opened), standing
 * edge-on and tilted, then grows into its layout position while turning to face the viewer. Time 0 is the moment
 * the capsule opens.
 */
export function revealCapsuleCard({ root, flipper, panel, onComplete }: Reveal) {
  const sweep = root.querySelector<HTMLElement>('.capsule-card-sweep')
  const bounds = root.getBoundingClientRect()
  const dx = window.innerWidth / 2 - (bounds.left + bounds.width / 2)
  const dy = window.innerHeight / 2 - (bounds.top + bounds.height / 2)

  gsap.set(flipper, { rotationY: 88 })
  gsap.set(root, { x: dx, y: dy + 10, scale: 0.12, rotation: -14, opacity: 0 })
  if (panel) gsap.set(panel, { opacity: 0 })

  const timeline = gsap.timeline({
    onComplete: () => {
      gsap.set(root, { clearProps: 'transform,opacity' })
      gsap.set(flipper, { clearProps: 'transform' })
      if (sweep) gsap.set(sweep, { clearProps: 'transform,opacity' })
      if (panel) gsap.set(panel, { clearProps: 'opacity' })
      onComplete()
    },
  })
    .to(root, { opacity: 1, duration: 0.4 }, 0.45)
    .to(root, { scale: 1, x: 0, y: 0, duration: 2.1, ease: 'power2.inOut' }, 0.45)
    .to(root, { rotation: -5, duration: 2.0, ease: 'sine.out' }, 0.45)
    .to(flipper, { rotationY: -10, duration: 1.9, ease: 'power2.inOut' }, 0.45)
    .to(flipper, { rotationY: 0, duration: 1.3, ease: 'sine.inOut' }, 2.1)
    .to(root, { rotation: 0, duration: 1.5, ease: 'sine.inOut' }, 2.3)
  // The controls follow once the card has nearly settled.
  if (panel) timeline.to(panel, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 2.0)
  if (sweep) timeline.fromTo(sweep, { xPercent: -100, opacity: 1 }, { xPercent: 100, duration: 1.1, ease: 'power2.inOut' }, 2.6).set(sweep, { opacity: 0 })
  return timeline
}

/** Inset so the light grazing the card's rounded edge is not cut off. */
const QUAD_INSET = 6

/**
 * The capsule card's four corners on screen while the intro moves it, or null while it is hidden.
 * The card's own box is the untransformed scene box; the root (move, scale, tilt) and flipper (turn) transforms are
 * applied around its center, then the scene's perspective. A bounding box would also cover the empty corners of
 * the tilted, edge-on card.
 */
export function capsuleCardQuad(): CardQuad | null {
  const scene = document.querySelector<HTMLElement>('.capsule-share-page[data-intro] .capsule-card-scene')
  const root = scene?.querySelector<HTMLElement>('.capsule-card-root')
  const flipper = root?.querySelector<HTMLElement>('.capsule-card-flipper')
  if (!scene || !root || !flipper) return null
  const rootStyle = getComputedStyle(root)
  if (Number(rootStyle.opacity) < 0.02) return null
  const box = scene.getBoundingClientRect()
  const transform = (value: string) => new DOMMatrix(value === 'none' ? undefined : value)
  const matrix = transform(rootStyle.transform).multiply(transform(getComputedStyle(flipper).transform))
  const perspective = parseFloat(getComputedStyle(scene).perspective) || 0
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2
  const hw = box.width / 2 - QUAD_INSET, hh = box.height / 2 - QUAD_INSET
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const).map(([x, y]) => {
    const point = matrix.transformPoint(new DOMPoint(x, y, 0, 1))
    const scale = perspective ? perspective / (perspective - point.z) : 1
    return [cx + (point.x / point.w) * scale, cy + (point.y / point.w) * scale] as const
  })
}
