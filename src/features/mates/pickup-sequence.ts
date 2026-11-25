/**
 * "공부 시작하기" → call: the hang-up (hangup-sequence.ts) played in reverse, so starting a call feels like picking
 * up the phone.
 *
 * Phase 1 (home, ~2.7s, alongside the connect request): the room darkens; the red handset, lying hung up, rings
 * (shakes), lifts, and turns upright to the call's purple while "채린과 연결하는 중" shows; then a dot of light
 * appears and stretches into a line — the TV switching on.
 * Phase 2 (call page, 0.7s): from that line the call screen opens vertically to full size.
 *
 * The overlay is plain DOM on <body>, not React, so it survives the route change (and hides the lazy route's
 * loading fallback) until the call page takes it over with `handoff`. Web Animations on individual properties, as
 * in the hang-up, so `cancel()` drops everything at once.
 */
import handsetPurple from '@/assets/connection/hangup-handset-3d.webp'
import handsetRed from '@/assets/connection/hangup-handset-3d-red.webp'
import { withParticle } from '@/shared/lib/korean'
import './call-pickup.css'

/** Phase 1 beats, in ms. */
export const PICKUP_TIMING = {
  dim: 260,
  handsetAt: 140,
  ringFrom: 480,
  ringTo: 1160,
  liftTo: 1300,
  upright: 1760,
  handsetOutFrom: 1980,
  handsetOutTo: 2220,
  dotAt: 2160,
  dot: 2320,
  line: 2700,
  total: 2700,
  reducedTotal: 160,
} as const

/** Phase 2 (the screen opening from the line), in ms. */
export const PICKUP_OPEN = 700

/** If no call page takes the overlay over in this long after phase 1, it removes itself. */
const ORPHAN_TIMEOUT_MS = 8000

const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)'
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)'
const EASE_IN = 'cubic-bezier(.55, 0, .75, .2)'

export type PickupPlayback = {
  /** True when phase 1 ran to its end; false when it was cancelled. */
  finished: Promise<boolean>
  /** Phase 2 on the call page: open its `.connection-screen` from the line, then remove the overlay. */
  handoff: (root: HTMLElement | null) => void
  /** Remove the overlay at once (e.g. the connect request failed). */
  cancel: () => void
  /** Name another mate in the label: the connection that continued was with them (409 hand-off). */
  rename: (name: string) => void
}

let current: PickupPlayback | null = null

/** The pickup waiting for the call page, if any (taken once). */
export function takePickup(): PickupPlayback | null {
  const playback = current
  current = null
  return playback
}

export function playPickup({ name, reduced }: { name: string; reduced: boolean }): PickupPlayback {
  current?.cancel()
  const overlay = document.createElement('div')
  overlay.className = 'call-pickup'
  overlay.innerHTML = `
    <div class="call-pickup-dim"></div>
    <div class="call-pickup-crt"></div>
    <div class="call-pickup-handset">
      <img src="${handsetPurple}" width="480" height="480" alt="" draggable="false" />
      <img class="call-pickup-handset-red" src="${handsetRed}" width="480" height="480" alt="" draggable="false" />
    </div>
    <p class="call-pickup-label" aria-hidden="true"><span class="call-pickup-label-dot"></span><strong></strong></p>
    <p class="sr-only" role="status"></p>`
  const setLabel = (value: string) => {
    const label = `${withParticle(value, '과', '와')} 연결하는 중`
    overlay.querySelector('strong')!.textContent = label
    overlay.querySelector('[role="status"]')!.textContent = `${label}이에요.`
  }
  setLabel(name)
  document.body.append(overlay)

  const animations: Animation[] = []
  const run = (selector: string, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const element = overlay.querySelector<HTMLElement>(selector)
    if (!element || typeof element.animate !== 'function') return
    animations.push(element.animate(keyframes, { fill: 'both', easing: 'linear', ...options }))
  }

  if (reduced) {
    run('.call-pickup-dim', [{ opacity: 0 }, { opacity: 1 }], { duration: PICKUP_TIMING.reducedTotal })
  } else {
    const t = PICKUP_TIMING
    run('.call-pickup-dim', [
      { opacity: 0, easing: EASE_OUT },
      { opacity: 1 },
    ], { duration: t.dim })

    // The handset: hung up and red → rings → lifts → turns upright to purple → fades, all on one timeline.
    const span = t.handsetOutTo - t.handsetAt
    const at = (ms: number) => (ms - t.handsetAt) / span
    const HUNG = { rotate: '135deg', translate: '0 40px', scale: 0.9 }
    const RED_GLOW = 'drop-shadow(0 12px 30px rgb(240 78 102 / .5))'
    const PURPLE_GLOW = 'drop-shadow(0 12px 28px rgb(126 84 246 / .45))'
    const ring: Keyframe[] = []
    // Two short bursts of ringing.
    for (const [from, to] of [[t.ringFrom, t.ringFrom + 280], [t.ringFrom + 400, t.ringTo]] as const) {
      const steps = 6
      for (let i = 0; i <= steps; i += 1) {
        const tilt = i === 0 || i === steps ? 0 : (i % 2 ? 9 : -9)
        ring.push({ opacity: 1, ...HUNG, rotate: `${135 + tilt}deg`, filter: RED_GLOW, offset: at(from + ((to - from) * i) / steps) })
      }
    }
    run('.call-pickup-handset', [
      { opacity: 0, ...HUNG, translate: '0 56px', filter: RED_GLOW, easing: EASE_OUT },
      { opacity: 1, ...HUNG, filter: RED_GLOW, offset: at(t.ringFrom - 60) },
      ...ring,
      // Lift: a small dip, then up.
      { opacity: 1, ...HUNG, translate: '0 46px', filter: RED_GLOW, offset: at(t.ringTo + 50), easing: EASE_OUT },
      { opacity: 1, ...HUNG, translate: '0 26px', scale: 0.92, filter: RED_GLOW, offset: at(t.liftTo), easing: EASE_IN_OUT },
      // Turn upright, red → purple.
      { opacity: 1, rotate: '0deg', translate: '0 0', scale: 1, filter: PURPLE_GLOW, offset: at(t.upright) },
      { opacity: 1, rotate: '0deg', translate: '0 0', scale: 1, filter: PURPLE_GLOW, offset: at(t.handsetOutFrom), easing: EASE_IN },
      { opacity: 0, rotate: '0deg', translate: '0 -6px', scale: 0.92, filter: PURPLE_GLOW },
    ], { delay: t.handsetAt, duration: span })
    run('.call-pickup-handset-red', [
      { opacity: 1 },
      { opacity: 1, offset: at(t.liftTo), easing: EASE_IN_OUT },
      { opacity: 0, offset: at(t.upright) },
      { opacity: 0 },
    ], { delay: t.handsetAt, duration: span })
    run('.call-pickup-label', [
      { opacity: 0, translate: '0 6px', easing: EASE_OUT },
      { opacity: 1, translate: '0 0', offset: at(t.ringFrom) },
      { opacity: 1, translate: '0 0', offset: at(t.handsetOutFrom), easing: EASE_IN },
      { opacity: 0, translate: '0 0' },
    ], { delay: t.handsetAt, duration: span })

    // TV on, first half: a dot of light appears and stretches into a line across the screen.
    run('.call-pickup-crt', [
      { opacity: 0, width: '3px', height: '3px', easing: EASE_OUT },
      { opacity: 1, width: '7px', height: '7px', offset: (t.dot - t.dotAt) / (t.line - t.dotAt), easing: EASE_IN_OUT },
      { opacity: 1, width: '100%', height: '3px' },
    ], { delay: t.dotAt, duration: t.line - t.dotAt })
  }

  let cancelled = false
  let orphanTimer: ReturnType<typeof setTimeout> | undefined
  const remove = () => {
    clearTimeout(orphanTimer)
    for (const animation of animations) animation.cancel()
    overlay.remove()
    if (current === playback) current = null
  }
  const finished = Promise.all(animations.map(animation => animation.finished)).then(() => !cancelled, () => false)
  void finished.then(done => { if (done) orphanTimer = setTimeout(remove, ORPHAN_TIMEOUT_MS) })

  const playback: PickupPlayback = {
    finished,
    cancel() {
      cancelled = true
      remove()
    },
    rename: setLabel,
    handoff(root) {
      clearTimeout(orphanTimer)
      const screen = root?.querySelector<HTMLElement>('.connection-screen')
      const duration = reduced ? PICKUP_TIMING.reducedTotal : PICKUP_OPEN
      const ending: Animation[] = []
      const fadeOverlay = (element: Element | null, ms: number) => {
        if (element instanceof HTMLElement && typeof element.animate === 'function') {
          ending.push(element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }], { duration: ms, fill: 'forwards', easing: EASE_OUT }))
        }
      }
      if (screen && !reduced && typeof screen.animate === 'function') {
        // TV on, second half: the screen opens vertically from the line, flaring, then settles.
        ending.push(screen.animate([
          { scale: '1 0.004', filter: 'brightness(3.2) saturate(0.2)', easing: EASE_IN_OUT },
          { scale: '1 1', filter: 'brightness(1.35) saturate(1)', offset: 0.62, easing: EASE_OUT },
          { scale: '1 1', filter: 'brightness(1) saturate(1)' },
        ], { duration, fill: 'backwards' }))
        fadeOverlay(overlay.querySelector('.call-pickup-crt'), 140)
        fadeOverlay(overlay.querySelector('.call-pickup-dim'), 160)
      } else {
        fadeOverlay(overlay, duration)
      }
      void Promise.all(ending.map(animation => animation.finished)).catch(() => {}).then(() => {
        for (const animation of ending) animation.cancel()
        remove()
      })
    },
  }
  current = playback
  return playback
}
