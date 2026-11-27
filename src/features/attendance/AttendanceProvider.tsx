import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAttendance } from './use-attendance'
import { AttendanceContext, type AttendanceRunner } from './attendance-controller'
import { holdCreditReward, landCreditReward } from './credit-reward'
import { markAttendanceReceived } from './attendance-service'
import { useBackend } from '@/features/backend/backend-context'

/**
 * One attendance state for the home page, shared by the hero CTA, the hero's attendance path and the activity
 * summary. A mounted attendance widget may take over the check-in with its own sequence; the CTA only asks to start.
 *
 * With the `credits` source the server has already put today's 1,500 in the balance (`pendingCredit`): while it waits
 * for the button here, the header chip holds it back (credit-reward.ts), so the check-in counts the chip up to the
 * server balance instead of showing it before. With the attendance API the check-in's own credit summary does that.
 *
 * Leaving the home page with the amount still held counts today as received (decided 2026-11-27): the hold is
 * released as a landing, so the chip counts up once instead of showing a different number on the next screen, and
 * coming back home the same day shows today 「받음」 (attendance-service.ts `markAttendanceReceived`).
 */
export function AttendanceProvider({ children }: { children: ReactNode }) {
  const attendance = useAttendance()
  const userId = useBackend().me?.userId
  const owner = useRef(userId)
  useEffect(() => { owner.current = userId }, [userId])
  const runner = useRef<AttendanceRunner | null>(null)
  const hold = useRef<{ amount: number; release: () => void } | null>(null)
  const [busy, setBusy] = useState(false)
  const register = useCallback((next: AttendanceRunner | null) => { runner.current = next }, [])
  const { checkIn } = attendance
  const pendingCredit = attendance.state.checkedToday ? 0 : attendance.state.pendingCredit ?? 0

  // Before paint, so the chip never shows today's credits before the button plays them.
  useLayoutEffect(() => {
    if ((hold.current?.amount ?? 0) === pendingCredit) return
    hold.current?.release()
    hold.current = pendingCredit > 0 ? { amount: pendingCredit, release: holdCreditReward(pendingCredit) } : null
  }, [pendingCredit])
  useEffect(() => () => {
    const left = hold.current
    hold.current = null
    if (!left) return
    // Only the `credits` source holds anything back, so this is always that path.
    if (owner.current !== undefined) markAttendanceReceived(owner.current)
    landCreditReward(left.amount, left.release)
  }, [])

  const start = useCallback(async () => {
    if (runner.current) return runner.current()
    setBusy(true)
    try {
      const { credit } = await checkIn()
      const release = hold.current?.release
      hold.current = null
      if (credit > 0) landCreditReward(credit, release)
      else release?.()
    } finally {
      setBusy(false)
    }
  }, [checkIn])
  const value = useMemo(() => ({ ...attendance, busy, start, register, setBusy }), [attendance, busy, start, register])
  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}
