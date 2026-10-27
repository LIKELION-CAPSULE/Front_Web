import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { dateLabel, duration } from '@/shared/lib/format'

export function SessionList({ records }: { records: readonly StudyRecord[] }) {
  if (!records.length) return <p className="text-sm text-muted">이 기간에는 공부 기록이 없어요.</p>
  return (
    <div>
      {records.map((record) => (
        <Link
          key={record.id}
          to={`/reports/${record.id}`}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-divider py-3 text-sm hover:text-brand-strong"
        >
          <span>
            {dateLabel(record.endedAt)} · {getStudyRoom(record.roomId)?.name ?? '스터디룸'}
          </span>
          <span className="font-mono text-xs">
            {duration(record.studySeconds)}
            {record.targetSeconds && (
              <small className="ml-2 text-subtle">/ 목표 {duration(record.targetSeconds)}</small>
            )}
          </span>
        </Link>
      ))}
    </div>
  )
}
