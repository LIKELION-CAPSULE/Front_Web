import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { focusDetectedSeconds } from '@/features/session/focus'
import { Icon } from '@/shared/ui/Icon'
import { dateLabel, duration } from '@/shared/lib/format'

export function RecentConnectionRow({
  record,
  mateName,
  showConnectionLabel = false,
}: {
  record: StudyRecord
  mateName?: string
  showConnectionLabel?: boolean
}) {
  const togetherSecs = record.cameraFocus ? focusDetectedSeconds(record) : 0
  const leveledUp = Boolean(record.serverReport?.relation?.levelUp)

  return (
    <Link to={`/connections/${record.id}`} className="my-mates-recent-row">
      <span className="my-mates-recent-meta">
        <span className="my-mates-recent-date">{dateLabel(record.endedAt)}</span>
        {mateName && (
          <>
            <span className="my-mates-recent-sep" aria-hidden="true">
              ·
            </span>
            <span className="my-mates-recent-mate">{mateName}</span>
          </>
        )}
        {togetherSecs > 0 && (
          <>
            <span className="my-mates-recent-sep" aria-hidden="true">
              ·
            </span>
            <span className="my-mates-recent-together">
              함께한 시간 {duration(togetherSecs)}
            </span>
          </>
        )}
        <span className="my-mates-recent-sep" aria-hidden="true">
          ·
        </span>
        <span className="my-mates-recent-duration">
          {showConnectionLabel ? `연결 시간 ${duration(record.studySeconds)}` : duration(record.studySeconds)}
        </span>
        {leveledUp && <span className="my-mates-levelup-badge">단계 상승</span>}
      </span>
      <Icon name="chevron" size={16} className="my-mates-recent-chevron" />
    </Link>
  )
}
