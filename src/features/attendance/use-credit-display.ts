import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useBackend } from '@/features/backend/backend-context'
import { useCreditReward } from './credit-reward'

/**
 * The credit balance as every surface should show it (header chip, activity summary): the wallet plus rewards
 * earned on this page, counting up when an attendance reward lands. `null` when there is no wallet to show.
 */
export function useCreditDisplay() {
  const { wallet } = useBackend()
  const { bonus, landing } = useCreditReward()
  const total = wallet ? wallet.attendance + wallet.invitation + bonus : null
  const [counting, setCounting] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const landed = useRef(landing?.id)

  useEffect(() => {
    if (!landing || landing.id === landed.current || total === null) return
    landed.current = landing.id
    if (reduced) return
    const count = animate(total - landing.amount, total, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (value) => setCounting(Math.round(value)),
      onComplete: () => setCounting(null),
    })
    return () => {
      count.stop()
      setCounting(null)
    }
  }, [total, landing, reduced])

  return { value: total === null ? null : counting ?? total, landing }
}
