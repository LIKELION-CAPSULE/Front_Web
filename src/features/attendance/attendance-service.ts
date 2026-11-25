import { applyCheckIn, dayKey, defaultRewards, resolveAttendance, type AttendanceState, type StoredAttendance } from './attendance-model.ts'

/**
 * The only place that talks to "the server". There is no attendance API yet, so this keeps the state in this
 * browser per account. To switch to the real API, replace `fetchAttendance` and `postCheckIn` with requests through
 * the shared API client (`@/shared/api/client`) and keep their return shapes; nothing else needs to change.
 */
const LATENCY_MS = 160
const key = (userId: number | undefined) => `capsule-attendance-mock:${userId ?? 'guest'}`

function read(userId: number | undefined): StoredAttendance {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? 'null')
    if (value && typeof value === 'object' && 'cycleDay' in value) {
      const { cycleDay, lastCheckedOn, totalDays } = value as Record<string, unknown>
      return { cycleDay: Number(cycleDay) || 0, lastCheckedOn: typeof lastCheckedOn === 'string' ? lastCheckedOn : null, totalDays: Number(totalDays) || 0 }
    }
  } catch { /* A broken or blocked store starts from day 1. */ }
  return { cycleDay: 0, lastCheckedOn: null }
}

function write(userId: number | undefined, stored: StoredAttendance) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(stored))
  } catch { /* The check-in still shows; it just is not remembered. */ }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const today = () => dayKey(new Date())

export async function fetchAttendance(userId: number | undefined): Promise<AttendanceState> {
  return resolveAttendance(read(userId), today(), defaultRewards())
}

export async function postCheckIn(userId: number | undefined): Promise<{ state: AttendanceState; credit: number }> {
  await wait(LATENCY_MS)
  const result = applyCheckIn(read(userId), today(), defaultRewards())
  write(userId, result.stored)
  return { state: result.state, credit: result.reward.credit }
}

/** Development only: jump to any point of the cycle to replay a check-in. */
export function setMockAttendance(userId: number | undefined, cycleDay: number, checkedToday: boolean) {
  const { totalDays = 0 } = read(userId)
  write(userId, { cycleDay, lastCheckedOn: checkedToday ? today() : null, totalDays: Math.max(totalDays, cycleDay) })
}
