import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { defaultRewards, type AttendanceState } from './attendance-model'
import { fetchAttendance, postCheckIn, setMockAttendance } from './attendance-service'

const EMPTY: AttendanceState = { cycleDay: 0, checkedToday: false, totalDays: 0, rewards: defaultRewards() }

/** Attendance for the signed-in account. `checkIn` resolves with the credit earned once the server confirms it. */
export function useAttendance() {
  const { state: demo } = useDemo()
  const userId = demo.profile.userId
  const [state, setState] = useState<AttendanceState>(EMPTY)
  const [isLoading, setLoading] = useState(true)
  const pending = useRef(false)

  const reload = useCallback(async () => {
    const next = await fetchAttendance(userId)
    setState(next)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    let alive = true
    void fetchAttendance(userId).then((next) => {
      if (!alive) return
      setState(next)
      setLoading(false)
    })
    return () => { alive = false }
  }, [userId])

  const checkIn = useCallback(async () => {
    if (pending.current) throw new Error('출석을 처리하고 있어요.')
    pending.current = true
    try {
      const result = await postCheckIn(userId)
      setState(result.state)
      return { credit: result.credit }
    } finally {
      pending.current = false
    }
  }, [userId])

  /** Development only. */
  const devSet = useCallback(async (cycleDay: number, checkedToday: boolean) => {
    setMockAttendance(userId, cycleDay, checkedToday)
    await reload()
  }, [userId, reload])

  return { state, checkIn, isLoading, devSet }
}
