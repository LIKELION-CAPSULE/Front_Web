import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { duration } from '@/shared/lib/format'
import {
  capsuleFillRatio,
  capsuleFillSteps,
  capsuleNeighbor,
  capsuleRevealOrder,
  capsuleRevealTiming,
  capsuleTooltip,
  type CapsuleCalendarData,
  type CapsuleDay,
} from './capsule-calendar'
import './capsule-calendar.css'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

/** Legend: empty capsule → full capsule, with the connection-time steps. */
export function CapsuleLegend({ mode }: { mode: CapsuleCalendarData['mode'] }) {
  return (
    <div className="capsule-legend" data-mode={mode} aria-label="캡슐 채움 범례">
      <span className="capsule-legend-item">
        <span className="capsule" data-level="0" aria-hidden="true" />
        없음
      </span>
      {capsuleFillSteps.map((step) => (
        <span key={step.level} className="capsule-legend-item">
          <span className="capsule" data-level={step.level} aria-hidden="true">
            <span className="capsule-fill" style={{ '--fill': capsuleFillRatio(step.level) } as CSSProperties} />
          </span>
          {step.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Capsule calendar. Mount with a new `key` per period/mate so the fill-in plays once per view.
 * Selecting a day reports the day; the parent pairs it with that day's records (`selectCapsuleDay`).
 */
export function CapsuleCalendar({
  data,
  selectedKey,
  onSelect,
}: {
  data: CapsuleCalendarData
  selectedKey: string | undefined
  onSelect: (day: CapsuleDay) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  const { days, mode, leadingBlanks } = data
  const revealOrder = capsuleRevealOrder(days)
  const timing = capsuleRevealTiming(revealOrder.filter((order) => order !== null).length)
  const rovingKey = focusKey ?? selectedKey ?? days.find((day) => !day.isFuture)?.key

  // Year grass is wider than small screens: start scrolled to the selected day (today by default).
  const initialKey = useRef(selectedKey)
  useEffect(() => {
    const scroller = scrollRef.current
    if (mode !== 'year' || !scroller || scroller.scrollWidth <= scroller.clientWidth) return
    const index = days.findIndex((day) => day.key === initialKey.current)
    const target = buttons.current[index]
    if (target) scroller.scrollLeft = Math.max(0, target.offsetLeft - scroller.clientWidth * 0.7)
  }, [mode, days])

  const showTooltip = (day: CapsuleDay, target: HTMLElement) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const box = wrap.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    setTooltip({ text: capsuleTooltip(day), x: rect.left - box.left + rect.width / 2, y: rect.top - box.top })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = capsuleNeighbor(mode, index, event.key, days)
    if (next === null) return
    event.preventDefault()
    const day = days[next]
    if (!day) return
    setFocusKey(day.key)
    buttons.current[next]?.focus()
  }

  const gridStyle = {
    '--capsule-step': `${timing.stepMs}ms`,
    '--capsule-fill-ms': `${timing.fillMs}ms`,
    ...(mode === 'year' ? { '--capsule-columns': Math.ceil((days.length + leadingBlanks) / 7) } : {}),
  } as CSSProperties

  return (
    <div className="capsule-calendar" data-mode={mode} ref={wrapRef} onMouseLeave={() => setTooltip(null)}>
      {mode === 'month' && (
        <div className="capsule-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      )}
      <div className="capsule-scroll" ref={scrollRef}>
        {mode === 'year' && (
          <div className="capsule-months" aria-hidden="true" style={gridStyle}>
            {data.monthMarks.map((mark) => (
              <span key={mark.label} style={{ gridColumnStart: mark.column + 1 }}>
                {mark.label}
              </span>
            ))}
          </div>
        )}
        <div className="capsule-year-body">
          {mode === 'year' && (
            <div className="capsule-year-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day, index) => (
                <span key={day}>{index % 2 === 0 ? day : ''}</span>
              ))}
            </div>
          )}
          <div className="capsule-grid" role="group" aria-label="함께한 날 캡슐 달력" style={gridStyle}>
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} className="capsule-blank" aria-hidden="true" />
            ))}
            {days.map((day, index) => (
              <button
                key={day.key}
                ref={(element) => {
                  buttons.current[index] = element
                }}
                type="button"
                className="capsule-day"
                data-capsule-day={day.key}
                data-level={day.level}
                data-today={day.isToday || undefined}
                data-future={day.isFuture || undefined}
                aria-pressed={day.key === selectedKey}
                aria-label={capsuleTooltip(day)}
                disabled={day.isFuture}
                tabIndex={day.key === rovingKey ? 0 : -1}
                style={revealOrder[index] === null ? undefined : ({ '--i': revealOrder[index] } as CSSProperties)}
                onClick={() => {
                  setFocusKey(day.key)
                  onSelect(day)
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                onMouseEnter={(event) => showTooltip(day, event.currentTarget)}
                onFocus={(event) => showTooltip(day, event.currentTarget)}
                onBlur={() => setTooltip(null)}
              >
                {day.label && <span className="capsule-day-label">{day.label}</span>}
                <span className="capsule" data-level={day.level} aria-hidden="true">
                  {day.level > 0 && (
                    <span className="capsule-fill" style={{ '--fill': capsuleFillRatio(day.level) } as CSSProperties} />
                  )}
                </span>
                {mode === 'week' && (
                  <span className="capsule-day-time" aria-hidden="true">
                    {day.sessions > 0 ? duration(day.connectionSeconds) : ' '}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tooltip && (
        <span className="capsule-tooltip" role="presentation" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </span>
      )}
    </div>
  )
}
