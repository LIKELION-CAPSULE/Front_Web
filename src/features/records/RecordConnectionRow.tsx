import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { focusDetectedSeconds } from '@/features/session/focus'
import { Icon } from '@/shared/ui/Icon'
import { dateLabel, duration } from '@/shared/lib/format'
import { capsuleDaySummary, type SelectedCapsuleDay } from './capsule-calendar'
import { connectionStartedAt } from './connection-day'

const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * One connection on /records. "함께한 시간" is the connection time; camera time is shown only when measured.
 * `when: 'time'` shows the start–end time instead of the date (inside a selected day).
 */
export function RecordConnectionRow({
  record,
  mateName,
  when = 'date',
}: {
  record: StudyRecord
  mateName?: string
  when?: 'date' | 'time'
}) {
  const cameraSeconds = record.cameraFocus ? focusDetectedSeconds(record) : 0
  const leveledUp = Boolean(record.serverReport?.relation?.levelUp)
  const parts: ReactNode[] = []
  if (mateName) parts.push(<span key="mate">{mateName}</span>)
  parts.push(<span key="together" className="records-row-together">함께한 시간 {duration(record.studySeconds)}</span>)
  if (cameraSeconds > 0) parts.push(<span key="camera" className="records-row-camera">카메라로 함께한 시간 {duration(cameraSeconds)}</span>)

  return (
    <Link to={`/connections/${record.id}`} className="records-row">
      <span className="records-row-meta">
        <span className="records-row-when">
          {when === 'time' ? `${timeFormat.format(record.startedAt)} – ${timeFormat.format(record.endedAt)}` : dateLabel(connectionStartedAt(record))}
        </span>
        {parts.map((part, index) => (
          <span key={index} className="records-row-part">
            <span className="records-row-sep" aria-hidden="true">
              ·
            </span>
            {part}
          </span>
        ))}
        {leveledUp && <span className="records-row-badge">단계 상승</span>}
      </span>
      <Icon name="chevron" size={16} className="records-row-chevron" />
    </Link>
  )
}

/**
 * Selected day: summary line + that day's records. The record renderer is replaceable so the my-mates
 * "캡슐 기록 카드" can be plugged in later without touching the calendar.
 */
export function CapsuleDayDetail({
  selection,
  mateNameOf,
  renderRecord,
}: {
  selection: SelectedCapsuleDay
  mateNameOf: (record: StudyRecord) => string | undefined
  renderRecord?: (record: StudyRecord) => ReactNode
}) {
  const { day, records } = selection
  return (
    <div className="records-day-detail" data-selected-day={day.key}>
      <p className="records-day-summary" aria-live="polite" data-selected-day-summary>
        {capsuleDaySummary(day)}
      </p>
      {records.length > 0 && (
        <ul className="records-row-list records-day-list">
          {records.map((record) => (
            <li key={record.id}>
              {renderRecord ? renderRecord(record) : <RecordConnectionRow record={record} mateName={mateNameOf(record)} when="time" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
