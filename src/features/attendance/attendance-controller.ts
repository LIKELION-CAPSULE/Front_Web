import { createContext, useContext } from 'react'
import type { useAttendance } from './use-attendance'

export type AttendanceRunner = () => Promise<void>

export type AttendanceController = ReturnType<typeof useAttendance> & {
  /** A check-in is being requested or its sequence is playing; every trigger should be disabled. */
  busy: boolean
  /** Checks in and plays the widget's sequence; anything on the page (such as the hero CTA) may call it. */
  start: () => Promise<void>
  /** The widget hands over its sequence and reports when it is busy. */
  register: (runner: AttendanceRunner | null) => void
  setBusy: (busy: boolean) => void
}

export const AttendanceContext = createContext<AttendanceController | null>(null)

export function useAttendanceController() {
  const value = useContext(AttendanceContext)
  if (!value) throw new Error('useAttendanceController must be used inside AttendanceProvider.')
  return value
}
