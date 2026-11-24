/**
 * "연결 끊기" → capsule card: the call-screen half of the transition (0 → 3.22s).
 * The record page plays the rest from `connections.css` once it mounts.
 *
 * Paced so each beat reads on its own: the press, the screen squeezing to a line, the line holding, shrinking to a
 * dot, a breath of darkness, then the handset turning down to red, landing, and the call-ended label. Every keyframe carries its own easing over a linear
 * effect, so the offsets below land at exactly the milliseconds they say.
 *
 * Web Animations on individual `scale` / `translate` / `rotate` properties, not Motion: Motion writes `transform`,
 * which would erase the dock's own `translateX(-50%)` and hover magnification. `fill: 'forwards'` holds the end
 * state until the page leaves, and `cancel()` drops every effect at once, restoring the call screen untouched.
 */

/** Milliseconds from the confirm click. */
export const HANGUP_TIMING = {
  press: 280,
  /** The screen switches off like a CRT: it squeezes into a bright line, the line shrinks to a dot, the dot fades. */
  tvOffAt: 220,
  tvOff: 1300,
  /** A short dark beat, then the 3D handset appears, turns down red, lands, and "통화 종료" blinks. */
  handsetAt: 1620,
  handset: 1600,
  total: 3220,
  reducedTotal: 180,
} as const

/** TV-off beats, in ms from its start. */
const TV = { flare: 120, line: 500, swap: 560, hold: 720, dot: 1000, dotHold: 1120 } as const
/** Handset beats, in ms from its start. */
const HANDSET = { shown: 280, hold: 480, redFrom: 580, turned: 920, landed: 1020, rebound: 1110, settled: 1180, labelIn: 980, blink: 1320 } as const

const EASE_IN_OUT = 'cubic-bezier(.65, 0, .35, 1)'
const EASE_IN = 'cubic-bezier(.55, 0, .75, .2)'
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)'

export type HangupPlayback = {
  /** True when the sequence ran to its end; false when it was cancelled. */
  finished: Promise<boolean>
  cancel: () => void
}

export function playHangup(root: HTMLElement, reduced: boolean): HangupPlayback {
  const animations: Animation[] = []
  const run = (selector: string, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const element = root.querySelector<HTMLElement>(selector)
    if (!element || typeof element.animate !== 'function') return
    animations.push(element.animate(keyframes, { fill: 'forwards', easing: 'linear', ...options }))
  }

  if (reduced) {
    // Reduced motion: no movement, one short dim before the record page.
    run('.connection-hangup-dim', [{ opacity: 0 }, { opacity: 1 }], { duration: HANGUP_TIMING.reducedTotal })
  } else {
    const { press, tvOffAt, tvOff, handsetAt, handset } = HANGUP_TIMING
    const tv = (ms: number) => ms / tvOff
    const hs = (ms: number) => ms / handset

    // STEP 01: the red end button presses in and flashes.
    run('.connection-controls button[data-tone="danger"]', [
      { scale: 1, filter: 'brightness(1)', easing: EASE_OUT },
      { scale: 0.9, filter: 'brightness(1.3)', offset: 0.4, easing: EASE_IN_OUT },
      { scale: 1, filter: 'brightness(1)' },
    ], { duration: press })

    // STEP 02: TV off. The whole call screen flares, then squeezes vertically into a line.
    run('.connection-screen', [
      { scale: '1 1', filter: 'brightness(1) saturate(1)', opacity: 1, easing: EASE_OUT },
      { scale: '1 1', filter: 'brightness(1.35) saturate(1)', opacity: 1, offset: tv(TV.flare), easing: EASE_IN },
      { scale: '1 0.004', filter: 'brightness(3.2) saturate(0.2)', opacity: 1, offset: tv(TV.line) },
      { scale: '1 0.004', filter: 'brightness(3.2) saturate(0.2)', opacity: 0, offset: tv(TV.swap) },
      { scale: '1 0.004', filter: 'brightness(1) saturate(1)', opacity: 0 },
    ], { delay: tvOffAt, duration: tvOff })
    // The glowing line takes over, holds, shrinks to a round dot, lingers and fades. Width/height rather than scale
    // so the halo stays round; it is one tiny absolutely positioned bar, so no layout cost.
    run('.connection-hangup-crt', [
      { opacity: 0, width: '100%', height: '3px' },
      { opacity: 0, width: '100%', height: '3px', offset: tv(TV.line - 40) },
      { opacity: 1, width: '100%', height: '3px', offset: tv(TV.line) },
      { opacity: 1, width: '100%', height: '3px', offset: tv(TV.hold), easing: EASE_IN_OUT },
      { opacity: 1, width: '7px', height: '7px', offset: tv(TV.dot) },
      { opacity: 1, width: '7px', height: '7px', offset: tv(TV.dotHold), easing: EASE_IN },
      { opacity: 0, width: '3px', height: '3px' },
    ], { delay: tvOffAt, duration: tvOff })
    // Anything outside the screen (notices, dev tools) goes dark at the instant the screen is gone.
    run('.connection-hangup-dim', [
      { opacity: 0 },
      { opacity: 0, offset: tv(TV.swap) - 0.01 },
      { opacity: 1, offset: tv(TV.swap) },
      { opacity: 1 },
    ], { delay: tvOffAt, duration: tvOff })

    // STEP 03: the 3D handset rises in and rests, then turns down — going from the call's purple to the end-call
    // red — drops into its cradle with a small bounce, and the call-ended label blinks once with the final time.
    // It stays on screen; the page cross-fade takes it away.
    const PURPLE_GLOW = 'drop-shadow(0 12px 28px rgb(126 84 246 / .45))'
    const RED_GLOW = 'drop-shadow(0 12px 30px rgb(240 78 102 / .5))'
    run('.connection-hangup-handset', [
      { opacity: 0, scale: 0.8, rotate: '0deg', translate: '0 12px', filter: PURPLE_GLOW, easing: EASE_OUT },
      { opacity: 1, scale: 1, rotate: '0deg', translate: '0 0', filter: PURPLE_GLOW, offset: hs(HANDSET.shown) },
      { opacity: 1, scale: 1, rotate: '0deg', translate: '0 0', filter: PURPLE_GLOW, offset: hs(HANDSET.hold), easing: EASE_IN_OUT },
      { opacity: 1, scale: 0.9, rotate: '135deg', translate: '0 26px', filter: RED_GLOW, offset: hs(HANDSET.turned), easing: EASE_IN },
      { opacity: 1, scale: 0.9, rotate: '135deg', translate: '0 44px', filter: RED_GLOW, offset: hs(HANDSET.landed), easing: EASE_OUT },
      { opacity: 1, scale: 0.9, rotate: '135deg', translate: '0 36px', filter: RED_GLOW, offset: hs(HANDSET.rebound), easing: EASE_IN_OUT },
      { opacity: 1, scale: 0.9, rotate: '135deg', translate: '0 40px', filter: RED_GLOW, offset: hs(HANDSET.settled) },
      { opacity: 1, scale: 0.9, rotate: '135deg', translate: '0 40px', filter: RED_GLOW },
    ], { delay: handsetAt, duration: handset })
    run('.connection-hangup-handset-red', [
      { opacity: 0 },
      { opacity: 0, offset: hs(HANDSET.redFrom), easing: EASE_IN_OUT },
      { opacity: 1, offset: hs(HANDSET.turned) },
      { opacity: 1 },
    ], { delay: handsetAt, duration: handset })
    run('.connection-hangup-ended', [
      { opacity: 0, translate: '0 6px' },
      { opacity: 0, translate: '0 6px', offset: hs(HANDSET.labelIn), easing: EASE_OUT },
      { opacity: 1, translate: '0 0', offset: hs(HANDSET.labelIn + 200) },
      { opacity: 1, translate: '0 0', offset: hs(HANDSET.blink), easing: EASE_IN_OUT },
      { opacity: 0.3, translate: '0 0', offset: hs(HANDSET.blink + 90), easing: EASE_IN_OUT },
      { opacity: 1, translate: '0 0', offset: hs(HANDSET.blink + 180) },
      { opacity: 1, translate: '0 0' },
    ], { delay: handsetAt, duration: handset })
  }

  let cancelled = false
  const finished = Promise.all(animations.map(animation => animation.finished))
    .then(() => !cancelled, () => false)
  return {
    finished,
    cancel() {
      cancelled = true
      for (const animation of animations) animation.cancel()
    },
  }
}

/**
 * Resolves once `selector` is in the document (or after `timeout`), so a view transition never snapshots a Suspense
 * fallback. Polls with timers: rendering — requestAnimationFrame included — is suspended while a view transition's
 * update callback is pending, so a frame-based wait would stall the transition until the browser gives up.
 */
export function whenRendered(selector: string, timeout = 800): Promise<void> {
  return new Promise(resolve => {
    const started = performance.now()
    const check = () => {
      if (document.querySelector(selector) || performance.now() - started > timeout) resolve()
      else setTimeout(check, 16)
    }
    check()
  })
}
