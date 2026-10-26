import { useState } from 'react'
import type { StudyRecord } from '@/features/demo/types'
import { dayKey, duration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'

export function ActivityHeatmap({ records }: { records: readonly StudyRecord[] }) {
  const today = dayKey()
  const [selected, setSelected] = useState(today)
  const noon = new Date(`${today}T12:00:00+09:00`).getTime()
  const weekday = new Date(noon).getUTCDay()
  const start = noon - (((weekday + 6) % 7) + 21) * 86400000
  const totals = new Map<string, number>()
  for (const record of records) {
    const key = dayKey(record.endedAt)
    totals.set(key, (totals.get(key) ?? 0) + record.studySeconds)
  }
  const selectedTotal = totals.get(selected) ?? 0
  const days = Array.from({ length: 28 }, (_, i) => dayKey(start + i * 86400000))
  const attended = days.filter((day) => (totals.get(day) ?? 0) > 0).length
  return (
    <section className="activity-panel" aria-labelledby="activity-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">SMALL STEPS, EVERY DAY</p>
          <h2 id="activity-heading" className="text-lg font-semibold">
            집중이 쌓이는 달력
          </h2>
        </div>
        <span className="activity-summary">
          <Icon name="sparkle" size={14} />
          최근 4주 · {attended}일 함께했어요
        </span>
      </div>
      <div className="activity-layout">
        <div>
          <div className="activity-weekdays" aria-hidden="true">
            {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="activity-grid" role="group" aria-label="날짜별 공부 기록">
            {days.map((day) => {
              const seconds = totals.get(day) ?? 0
              const level =
                seconds === 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 5400 ? 3 : 4
              return (
                <button
                  key={day}
                  type="button"
                  data-level={level}
                  data-today={day === today}
                  aria-pressed={selected === day}
                  disabled={day > today}
                  aria-label={`${day.replaceAll('-', '.')} · ${seconds ? duration(seconds) : '공부 기록 없음'}`}
                  title={`${day} · ${duration(seconds)}`}
                  onClick={() => setSelected(day)}
                >
                  <span>{Number(day.slice(8))}</span>
                  {day === today && <span className="activity-today-dot" />}
                </button>
              )
            })}
          </div>
          <div className="activity-legend">
            <span>가볍게</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} data-level={level} />
            ))}
            <span>차곡차곡</span>
          </div>
        </div>
        <div className="activity-detail" aria-live="polite">
          <span className="text-xs text-muted">
            {selected.slice(5).replace('-', '월 ')}일{selected === today ? ' · 오늘' : ''}
          </span>
          <strong>{duration(selectedTotal)}</strong>
          <p>
            {selectedTotal
              ? '함께 앉아 있었던 시간만큼,\n우리의 이야기도 자라고 있어요.'
              : '아직 비어 있는 한 칸,\n오늘의 작은 집중을 채워 볼까요?'}
          </p>
          <span className="activity-note">
            <Icon name="book" size={15} />
            완료한 공부 기록 기준
          </span>
        </div>
      </div>
    </section>
  )
}
