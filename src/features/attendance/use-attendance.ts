import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useAttendanceGrant } from '@/features/backend/server-credits'
import { api } from '@/shared/api/client'
import { businessDay } from '@/shared/lib/format'
import { defaultRewards, type AttendanceState } from './attendance-model'
import { fetchAttendance, postCheckIn, setMockAttendance } from './attendance-service'

const EMPTY: AttendanceState = { cycleDay: 0, checkedToday: false, totalDays: 0, rewards: defaultRewards(), pendingCredit: 0 }

/**
 * The last 「checked in today」 state per account, for coming back to the home page the same business day: once today
 * is checked in it stays so until 05:00, so it can be shown at once while the page reads again (no 「출석하고 크레딧
 * 받기」 first). A state not checked in is never kept: the read may still say today was received meanwhile.
 */
const checkedStates = new Map<number, { day: string; state: AttendanceState }>()

function rememberChecked(userId: number, state: AttendanceState) {
  if (state.checkedToday) checkedStates.set(userId, { day: businessDay(), state })
  else checkedStates.delete(userId)
}

function cachedChecked(userId: number | undefined): AttendanceState | null {
  if (userId === undefined) return null
  const entry = checkedStates.get(userId)
  return entry && entry.day === businessDay() ? entry.state : null
}

/**
 * Attendance for the signed-in account, from the server (attendance-service.ts; the source is attendance-source.ts).
 * `checkIn` resolves with the credit received once the server side is done. Read again when a response says today's
 * credits were just granted (8 `/me` at start-up, usually). Not during the service tour: no credit calls there, and
 * the path shows the empty cycle.
 *
 * `isLoading` is true until the first read for this account lands (or a same-day 「checked in」 state is remembered):
 * `state` is only the empty placeholder then, and nothing may present it as the account's attendance.
 */
export function useAttendance() {
  const { status, me } = useBackend()
  const { search } = useLocation()
  const userId = me?.userId
  const touring = new URLSearchParams(search).has('tour')
  const ready = status === 'ready' && userId !== undefined && !touring
  const grant = useAttendanceGrant(userId)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; state: AttendanceState } | null>(null)
  const pending = useRef(false)
  const key = `${userId}:${attempt}:${grant?.id ?? 0}`

  useEffect(() => {
    if (!ready || userId === undefined) return
    let alive = true
    fetchAttendance(api, userId)
      .then(state => {
        if (!alive) return
        rememberChecked(userId, state)
        setResult({ key, state })
      })
      // Unreadable: the empty cycle, so the button still offers today's check-in (it reads again).
      .catch(() => { if (alive) setResult({ key, state: EMPTY }) })
    return () => { alive = false }
  }, [ready, userId, key])

  const current = result && result.key.startsWith(`${userId}:`) ? result : null
  const remembered = ready && !current ? cachedChecked(userId) : null
  const state = current?.state ?? remembered ?? EMPTY
  // The first read only: later reads keep showing the last state.
  const isLoading = ready && !current && !remembered

  const checkIn = useCallback(async () => {
    if (pending.current) throw new Error('출석을 처리하고 있어요.')
    if (userId === undefined) throw new Error('로그인 상태를 확인해 주세요.')
    pending.current = true
    try {
      const next = await postCheckIn(api, userId, state)
      rememberChecked(userId, next.state)
      setResult(previous => ({ key: previous?.key ?? key, state: next.state }))
      return { credit: next.credit }
    } catch (error) {
      setAttempt(value => value + 1)
      throw error
    } finally {
      pending.current = false
    }
  }, [userId, state, key])

  /** Development only. */
  const devSet = useCallback(async (cycleDay: number, checkedToday: boolean) => {
    if (userId === undefined) return
    setMockAttendance(userId, cycleDay, checkedToday)
    setAttempt(value => value + 1)
  }, [userId])

  return { state, checkIn, isLoading, devSet }
}
