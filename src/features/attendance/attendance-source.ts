/**
 * Where attendance comes from — the one switch between the server as it is and the attendance API the backend has
 * been asked for (2026-11-27). Change `ATTENDANCE_SOURCE` to `'attendance-api'` once `GET /attendance` and
 * `POST /attendance/check-in` are deployed; nothing else needs to change (attendance-service.ts picks the adapter, the
 * local mock follows the same switch).
 *
 * - `'credits'` (now): the server grants the day's 1,500 itself on the day's first credit read (docs/BACKEND_API.md
 *   4.5). Days come from 34 `filter=ATTENDANCE`, today also from the `attendanceGrantedNow` flag; the button plays
 *   receiving the 1,500 that is already in the balance.
 * - `'attendance-api'` (proposed): `GET /attendance` → `{ checkedToday, cycleDay, totalDays, rewardPerDay }`,
 *   `POST /attendance/check-in` → `{ granted, cycleDay, credits }` (409 `ALREADY_CHECKED_IN`).
 */
export type AttendanceSource = 'credits' | 'attendance-api'

export const ATTENDANCE_SOURCE: AttendanceSource = 'credits'

/** QA only (development, local mock and UI review): `sessionStorage['capsule-attendance-source'] = 'attendance-api'`. */
export const ATTENDANCE_SOURCE_QA_KEY = 'capsule-attendance-source'

export function attendanceSource(): AttendanceSource {
  if (import.meta.env?.DEV) {
    try {
      const value = globalThis.sessionStorage?.getItem(ATTENDANCE_SOURCE_QA_KEY)
      if (value === 'attendance-api' || value === 'credits') return value
    } catch { /* Storage blocked: the switch above. */ }
  }
  return ATTENDANCE_SOURCE
}
