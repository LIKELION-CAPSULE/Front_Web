import { useSyncExternalStore } from 'react'

/**
 * Lets the home attendance path hand today's reward to the header credit chip: the path flies "+N" to the chip, then
 * `landCreditReward` makes the header count up and bounce.
 *
 * The amount is already in the server balance (the server grants attendance on the day's first credit read, and says
 * so with `attendanceGrantedNow`; server-credits.ts). While the home path still has that grant to play, it holds the
 * amount back (`holdCreditReward`) so the chip shows the balance before it; landing releases it and counts up to the
 * server value. Nothing is added on top of the server balance.
 */
type Listener = () => void
type Landing = { id: number; amount: number }

let held = 0
let landing: Landing | null = null
let sequence = 0
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((listener) => listener())

/** Holds `amount` back from the chip until it lands (or the returned release runs). */
export function holdCreditReward(amount: number) {
  const value = Math.max(0, Math.trunc(amount) || 0)
  held += value
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    held = Math.max(0, held - value)
    emit()
  }
}

/** The reward reached the chip: the held amount is released and the chip counts up by `amount`. */
export function landCreditReward(amount: number, release?: () => void) {
  release?.()
  landing = { id: ++sequence, amount }
  emit()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useCreditReward() {
  const currentHeld = useSyncExternalStore(subscribe, () => held, () => 0)
  const currentLanding = useSyncExternalStore(subscribe, () => landing, () => null)
  return { held: currentHeld, landing: currentLanding }
}

/** The element rewards fly to, if the header is showing credits. */
export const creditTarget = () => document.querySelector<HTMLElement>('[data-credit-target]')
