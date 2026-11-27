import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useAttendanceGrant } from '@/features/backend/server-credits'
import { api } from '@/shared/api/client'
import { defaultRewards, type AttendanceState } from './attendance-model'
import { fetchAttendance, postCheckIn, setMockAttendance } from './attendance-service'

const EMPTY: AttendanceState = { cycleDay: 0, checkedToday: false, totalDays: 0, rewards: defaultRewards(), pendingCredit: 0 }

/**
 * Attendance for the signed-in account, from the server (attendance-service.ts; the source is attendance-source.ts).
 * `checkIn` resolves with the credit received once the server side is done. Read again when a response says today's
 * credits were just granted (8 `/me` at start-up, usually). Not during the service tour: no credit calls there, and
 * the path shows the empty cycle.
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
      .then(state => { if (alive) setResult({ key, state }) })
      // Unreadable: the empty cycle, so the button still offers today's check-in (it reads again).
      .catch(() => { if (alive) setResult({ key, state: EMPTY }) })
    return () => { alive = false }
  }, [ready, userId, key])

  const current = result && result.key.startsWith(`${userId}:`) ? result : null
  const state = current?.state ?? EMPTY
  // The first read only: later reads keep showing the last state.
  const isLoading = ready && !current

  const checkIn = useCallback(async () => {
    if (pending.current) throw new Error('출석을 처리하고 있어요.')
    if (userId === undefined) throw new Error('로그인 상태를 확인해 주세요.')
    pending.current = true
    try {
      const next = await postCheckIn(api, userId, state)
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
