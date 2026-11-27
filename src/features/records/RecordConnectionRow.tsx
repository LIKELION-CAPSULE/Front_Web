import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { StudyRecord } from '@/features/demo/types'
import { focusDetectedSeconds } from '@/features/session/focus'
import { Icon } from '@/shared/ui/Icon'
import { duration } from '@/shared/lib/format'
import { capsuleDaySummary, type SelectedCapsuleDay } from './capsule-calendar'

const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * One connection of the selected day on /records: its start–end time, the mate, "함께한 시간" (the connection time) and
 * the camera time only when measured. (The 「최근 연결」 list that showed dates was removed 2026-11-26.)
 */
export function RecordConnectionRow({ record, mateName }: { record: StudyRecord; mateName?: string }) {
  const cameraSeconds = record.cameraFocus ? focusDetectedSeconds(record) : 0
  const leveledUp = Boolean(record.serverReport?.relation?.stageUp)
  const parts: ReactNode[] = []
  if (mateName) parts.push(<span key="mate">{mateName}</span>)
  parts.push(<span key="together" className="records-row-together">함께한 시간 {duration(record.studySeconds)}</span>)
  if (cameraSeconds > 0) parts.push(<span key="camera" className="records-row-camera">카메라로 함께한 시간 {duration(cameraSeconds)}</span>)

  return (
    <Link to={`/connections/${record.id}`} className="records-row">
      <span className="records-row-meta">
        <span className="records-row-when">
          {`${timeFormat.format(record.startedAt)} – ${timeFormat.format(record.endedAt)}`}
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
 * The part of a day that 38 does not list as connections (older ones of that day): its time, no time of day and no
 * link (there is no single connection record behind it). `alone`: no connection of that day is listed, so the row is
 * the whole day (「이날 연결 합계」); otherwise it is what the listed ones leave (「그 밖의 연결 합계」).
 */
export function DayRemainderRow({ record, mateName, alone = false }: { record: StudyRecord; mateName?: string; alone?: boolean }) {
  const cameraSeconds = record.cameraFocus ? focusDetectedSeconds(record) : 0
  return (
    <div className="records-row records-row--remainder">
      <span className="records-row-meta">
        <span className="records-row-when">{alone ? '이날 연결 합계' : '그 밖의 연결 합계'}</span>
        {mateName && (
          <span className="records-row-part">
            <span className="records-row-sep" aria-hidden="true">·</span>
            <span>{mateName}</span>
          </span>
        )}
        <span className="records-row-part">
          <span className="records-row-sep" aria-hidden="true">·</span>
          <span className="records-row-together">함께한 시간 {duration(record.studySeconds)}</span>
        </span>
        {cameraSeconds > 0 && (
          <span className="records-row-part">
            <span className="records-row-sep" aria-hidden="true">·</span>
            <span className="records-row-camera">카메라로 함께한 시간 {duration(cameraSeconds)}</span>
          </span>
        )}
      </span>
    </div>
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
              {renderRecord ? renderRecord(record) : <RecordConnectionRow record={record} mateName={mateNameOf(record)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
