import { useEffect, useSyncExternalStore } from 'react'
import { connectionNoticeStore, dismissConnectionNotice } from '../connection-notice'
import './connection-notice.css'

/** The call screen's short notice (connection-notice.ts), read out once and gone after a while. */
export function ConnectionNotice({ durationMs = 6000 }: { durationMs?: number }) {
  const notice = useSyncExternalStore(connectionNoticeStore.subscribe, connectionNoticeStore.getSnapshot, () => null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => dismissConnectionNotice(notice.id), durationMs)
    return () => clearTimeout(timer)
  }, [notice, durationMs])
  return (
    <p className="connection-notice" role="status" data-tone={notice?.tone} hidden={!notice}>
      {notice?.text}
    </p>
  )
}
