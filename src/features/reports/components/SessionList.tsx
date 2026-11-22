import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { dateLabel, measuredDuration as duration } from '@/shared/lib/format'
import { focusDetectedSeconds } from '@/features/session/focus'

export function SessionList({ records }: { records: readonly StudyRecord[] }) {
  if (!records.length) return <p className="text-body-compact text-muted">아직 기록이 없어요.</p>
  return (
    <div>
      {records.map((record) => (
        <Link
          key={record.id}
          to={`/connections/${record.id}`}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-divider py-3 text-body-compact hover:text-text-accent"
        >
          <span>
            {dateLabel(record.endedAt)} · {record.characterName ?? record.serverReport?.character?.name ?? '메이트'}
          </span>
          <span className="font-sans tabular-nums text-caption">
            {record.cameraFocus ? duration(focusDetectedSeconds(record)) : '—'}
            <small className="ml-2 type-caption text-subtle">연결 시간 {duration(record.studySeconds)}</small>
          </span>
        </Link>
      ))}
    </div>
  )
}
