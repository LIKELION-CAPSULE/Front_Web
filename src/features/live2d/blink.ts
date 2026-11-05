import {
  BLINK_CLOSED_MS, BLINK_CLOSING_MS, BLINK_INTERVAL_MAX_MS, BLINK_INTERVAL_MIN_MS, BLINK_OPENING_MS,
} from './live2d-constants.ts'

/**
 * Automatic blinking as a multiplier on the eye-open parameters.
 * The library's own blink overwrites the eye values after expressions, so closed-eye and squinting
 * expressions would be undone. Multiplying keeps them: closed stays closed, a squint blinks from its squint.
 */
export type BlinkState = { startedAt: number | null; nextAt: number }

export function createBlinkState(now: number, random = Math.random): BlinkState {
  return { startedAt: null, nextAt: now + interval(random) }
}

function interval(random: () => number) {
  return BLINK_INTERVAL_MIN_MS + random() * (BLINK_INTERVAL_MAX_MS - BLINK_INTERVAL_MIN_MS)
}

/** Returns the eye-open multiplier for this frame (1 open, 0 closed) and the next state. */
export function stepBlink(state: BlinkState, now: number, random = Math.random): { state: BlinkState; factor: number } {
  const { nextAt } = state
  if (state.startedAt === null && now < nextAt) return { state, factor: 1 }
  const startedAt = state.startedAt ?? now
  const t = now - startedAt
  if (t < BLINK_CLOSING_MS) return { state: { startedAt, nextAt }, factor: 1 - t / BLINK_CLOSING_MS }
  if (t < BLINK_CLOSING_MS + BLINK_CLOSED_MS) return { state: { startedAt, nextAt }, factor: 0 }
  const opening = t - BLINK_CLOSING_MS - BLINK_CLOSED_MS
  if (opening < BLINK_OPENING_MS) return { state: { startedAt, nextAt }, factor: opening / BLINK_OPENING_MS }
  return { state: { startedAt: null, nextAt: now + interval(random) }, factor: 1 }
}
