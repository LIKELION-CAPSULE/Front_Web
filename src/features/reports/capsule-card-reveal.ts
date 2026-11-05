import gsap from 'gsap'

const parts = '.capsule-card-header, .share-portrait, .capsule-card-intro, .capsule-study-amount, .capsule-card-focus, .capsule-card-badge, .capsule-card-quote'

type Reveal = {
  root: HTMLElement
  flipper: HTMLElement
  /** The controls panel beside the card. */
  panel?: HTMLElement | null
  studySeconds: number
  /** Shows the counted study time; null shows the real value again. */
  count: (seconds: number | null) => void
  onComplete: () => void
}

/**
 * "Flip and fill": the card starts small at the screen center (where the capsule opened) with its back up, flips,
 * settles into its layout position, then fills in its contents. Time 0 is the moment the capsule opens.
 */
export function revealCapsuleCard({ root, flipper, panel, studySeconds, count, onComplete }: Reveal) {
  const card = root.querySelector<HTMLElement>('.capsule-share-card')!
  const items = card.querySelectorAll<HTMLElement>(`:scope > :is(${parts})`)
  const sweep = card.querySelector<HTMLElement>('.capsule-card-sweep')
  const bounds = root.getBoundingClientRect()
  const dx = window.innerWidth / 2 - (bounds.left + bounds.width / 2)
  const dy = window.innerHeight / 2 - (bounds.top + bounds.height / 2)
  const counter = { seconds: 0 }

  gsap.set(flipper, { rotationY: 180 })
  gsap.set(root, { x: dx, y: dy + 70, scale: 0.3, opacity: 0 })
  // Contents rise with a CSS variable feeding `translate`, so their tilt `transform` stays untouched.
  gsap.set(items, { opacity: 0, '--capsule-reveal-y': '12px' })
  if (panel) gsap.set(panel, { opacity: 0 })
  count(0)

  const timeline = gsap.timeline({
    onComplete: () => {
      gsap.set(root, { clearProps: 'transform,opacity' })
      gsap.set(flipper, { clearProps: 'transform' })
      gsap.set(items, { clearProps: 'opacity,--capsule-reveal-y' })
      if (sweep) gsap.set(sweep, { clearProps: 'transform,opacity' })
      if (panel) gsap.set(panel, { clearProps: 'opacity' })
      count(null)
      onComplete()
    },
  })
    .to(root, { opacity: 1, duration: 0.25 }, 0.08)
    .to(root, { scale: 0.8, y: dy - 14, duration: 0.6, ease: 'power3.out' }, 0.08)
    .to(flipper, { rotationY: 0, duration: 0.95, ease: 'power3.inOut' }, 0.5)
    .to(root, { scale: 1, x: 0, y: 0, duration: 1.0, ease: 'back.out(1.4)' }, 0.55)
    .to(items, { opacity: 1, '--capsule-reveal-y': '0px', duration: 0.45, ease: 'power2.out', stagger: 0.13 }, 1.0)
    .to(counter, { seconds: studySeconds, duration: 1.2, ease: 'power2.out', onUpdate: () => count(counter.seconds) }, 1.39)
  if (panel) timeline.to(panel, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 1.0)
  if (sweep) timeline.fromTo(sweep, { xPercent: -100, opacity: 1 }, { xPercent: 100, duration: 1.1, ease: 'power2.inOut' }, 2.1).set(sweep, { opacity: 0 })
  return timeline
}
