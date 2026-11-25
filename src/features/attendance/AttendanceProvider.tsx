import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAttendance } from './use-attendance'
import { AttendanceContext, type AttendanceRunner } from './attendance-controller'

/**
 * One attendance state for the home page, shared by the hero CTA, the attendance widget and the activity summary.
 * The widget owns the check-in sequence; the CTA only asks it to start.
 */
export function AttendanceProvider({ children }: { children: ReactNode }) {
  const attendance = useAttendance()
  const runner = useRef<AttendanceRunner | null>(null)
  const [busy, setBusy] = useState(false)
  const register = useCallback((next: AttendanceRunner | null) => { runner.current = next }, [])
  const { checkIn } = attendance
  const start = useCallback(async () => {
    // Without the widget (not mounted yet) the check-in still goes through, just without the show.
    if (runner.current) return runner.current()
    setBusy(true)
    try { await checkIn() } finally { setBusy(false) }
  }, [checkIn])
  const value = useMemo(() => ({ ...attendance, busy, start, register, setBusy }), [attendance, busy, start, register])
  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}
