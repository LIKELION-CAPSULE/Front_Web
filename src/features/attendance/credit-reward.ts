import { useSyncExternalStore } from 'react'

/**
 * Lets the attendance widget hand a reward to the header credit chip: the widget flies "+N" to the chip, then
 * `landCreditReward` makes the header count up and bounce.
 *
 * `bonus` is the credit earned through the mock in this page session. The server wallet does not know about it, so
 * the header adds it on top. Once check-in is a real API, refresh the wallet instead and drop the bonus.
 */
type Listener = () => void
type Landing = { id: number; amount: number }

let bonus = 0
let landing: Landing | null = null
let sequence = 0
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((listener) => listener())

export function landCreditReward(amount: number) {
  bonus += amount
  landing = { id: ++sequence, amount }
  emit()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useCreditReward() {
  const currentBonus = useSyncExternalStore(subscribe, () => bonus, () => 0)
  const currentLanding = useSyncExternalStore(subscribe, () => landing, () => null)
  return { bonus: currentBonus, landing: currentLanding }
}

/** The element rewards fly to, if the header is showing credits. */
export const creditTarget = () => document.querySelector<HTMLElement>('[data-credit-target]')
