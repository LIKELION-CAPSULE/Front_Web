import { useCallback, useEffect, useRef, useState } from 'react'
import { markGuideSeen, readGuideSeen } from './guide-seen'

/**
 * Opens the usage guide once by itself for an account that has never finished or skipped it, and on demand from
 * "사용법 보기". `ready` should only be true once the account is known and the home page is really showing.
 */
export function useUsageGuide({ ready, userId }: { ready: boolean; userId: number | undefined }) {
  const [open, setOpen] = useState(false)
  const checked = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!ready || userId === undefined || checked.current === userId || readGuideSeen(userId)) return
    // Wait a frame so the home page paints first and the guide opens over it rather than instead of it.
    const frame = requestAnimationFrame(() => {
      checked.current = userId
      setOpen(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, userId])

  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    markGuideSeen(userId)
    setOpen(false)
  }, [userId])

  return { open, show, close }
}
