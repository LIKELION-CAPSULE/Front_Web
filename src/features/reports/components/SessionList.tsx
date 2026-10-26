import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { dateLabel, duration } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'

export function SessionList({ records }: { records: StudyRecord[] }) {
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
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs">{duration(record.studySeconds)}</span>
            <Badge
              className={
                record.automatic
                  ? 'border border-dashed border-brand bg-panel'
                  : 'border border-line bg-panel text-muted'
              }
            >
              {record.automatic ? '자동 마감' : record.completed ? '정상 종료' : '직접 종료'}
            </Badge>
          </span>
        </Link>
      ))}
    </div>
  )
}
