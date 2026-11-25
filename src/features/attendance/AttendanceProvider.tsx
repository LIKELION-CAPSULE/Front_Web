import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAttendance } from './use-attendance'
import { AttendanceContext, type AttendanceRunner } from './attendance-controller'
import { landCreditReward } from './credit-reward'

/**
 * One attendance state for the home page, shared by the hero CTA, the hero's attendance path and the activity
 * summary. A mounted attendance widget may take over the check-in with its own sequence; the CTA only asks to start.
 */
export function AttendanceProvider({ children }: { children: ReactNode }) {
  const attendance = useAttendance()
  const runner = useRef<AttendanceRunner | null>(null)
  const [busy, setBusy] = useState(false)
  const register = useCallback((next: AttendanceRunner | null) => { runner.current = next }, [])
  const { checkIn } = attendance
  const start = useCallback(async () => {
    // Without a widget the check-in goes through without its show; the header still counts the reward up.
    if (runner.current) return runner.current()
    setBusy(true)
    try {
      const { credit } = await checkIn()
      landCreditReward(credit)
    } finally {
      setBusy(false)
    }
  }, [checkIn])
  const value = useMemo(() => ({ ...attendance, busy, start, register, setBusy }), [attendance, busy, start, register])
  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}
