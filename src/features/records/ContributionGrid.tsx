import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { duration } from '@/shared/lib/format'
import type { CapsuleDay } from './capsule-calendar'
import type { CapsuleBoardModel } from './capsule-board/capsule-board-layout'
import {
  GRID_LEVELS,
  gridLayout,
  gridNeighbor,
  gridTooltip,
  WEEKDAY_LABELS,
  yearWeekdayLabel,
  type GridDayMate,
} from './contribution-grid'
import './contribution-grid.css'

/** 「적음 ▢▢▢▢▢ 많음」 (GitHub's legend): the five shades, each named for screen readers. */
export function ContributionLegend() {
  const names = ['기록 없음', ...GRID_LEVELS.map((step) => step.label)]
  return (
    <p className="contribution-legend" aria-label={`색이 진할수록 함께한 시간이 길어요: ${names.join(', ')}`}>
      <span aria-hidden="true">적음</span>
      {names.map((name, level) => (
        <span key={name} className="contribution-swatch" data-level={level} title={name} aria-hidden="true" />
      ))}
      <span aria-hidden="true">많음</span>
    </p>
  )
}

/**
 * 내 기록 2D: the contribution grid (contribution-grid.ts). A cell per day, shaded by the day's time together; hover or
 * focus shows the date and the time (with 「전체」 each mate's time too), a press reports the day (the page opens its
 * record card). Arrow keys move between days (one tab stop); future days are disabled. Also the board when WebGL is
 * missing.
 */
export function ContributionGrid({
  model,
  selectedKey,
  onSelect,
  showMates,
}: {
  model: Pick<CapsuleBoardModel, 'calendar' | 'dayMates'>
  selectedKey: string | undefined
  onSelect: (day: CapsuleDay) => void
  /** 「전체」 with two or more mates: the tooltip lists each mate's time. */
  showMates: boolean
}) {
  const { days, mode } = model.calendar
  const layout = useMemo(() => gridLayout(mode, days.map((day) => day.key)), [mode, days])
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{ lines: string[]; x: number; y: number } | null>(null)
  const selectable = (key: string | undefined) => days.some((day) => day.key === key && !day.isFuture)
  const rovingKey =
    (selectable(focusKey) ? focusKey : undefined) ?? (selectable(selectedKey) ? selectedKey : undefined) ?? days.find((day) => !day.isFuture)?.key

  const mates = (day: CapsuleDay): GridDayMate[] => (showMates ? [...(model.dayMates.get(day.key) ?? [])] : [])
  const lines = (day: CapsuleDay) => gridTooltip(day, mates(day))

  // A year wider than the screen starts scrolled to the selected day (today by default).
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
    setTooltip({ lines: lines(day), x: rect.left - box.left + rect.width / 2, y: rect.top - box.top })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = gridNeighbor(mode, index, event.key, days)
    if (next === null) return
    event.preventDefault()
    const day = days[next]
    if (!day) return
    setFocusKey(day.key)
    buttons.current[next]?.focus()
  }

  const style = { '--grid-cols': layout.columns, '--grid-rows': layout.rows } as CSSProperties

  return (
    <div
      ref={wrapRef}
      className="contribution-grid"
      data-contribution-grid
      data-mode={mode}
      data-tour="records-board"
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="contribution-scroll" ref={scrollRef}>
        <div className="contribution-frame" style={style}>
          {mode === 'year' && (
            <div className="contribution-months" aria-hidden="true">
              {layout.monthLabels.map((mark) => (
                <span key={mark.label} style={{ gridColumnStart: mark.col + 1 }}>
                  {mark.label}
                </span>
              ))}
            </div>
          )}
          {mode === 'month' && (
            <div className="contribution-weekdays-top" aria-hidden="true">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          )}
          <div className="contribution-body">
            {mode === 'year' && (
              <div className="contribution-weekdays-side" aria-hidden="true">
                {WEEKDAY_LABELS.map((label, row) => (
                  <span key={label}>{yearWeekdayLabel(row)}</span>
                ))}
              </div>
            )}
            <div
              className="contribution-cells"
              role="group"
              aria-label="함께한 날 잔디. 방향키로 날짜를 옮기고 Enter로 그날 기록을 엽니다."
            >
              {layout.cells.map((cell) => {
                const day = days[cell.index]!
                const label = lines(day).join(', ')
                return (
                  <button
                    key={cell.key}
                    ref={(element) => {
                      buttons.current[cell.index] = element
                    }}
                    type="button"
                    className="contribution-cell"
                    data-grid-day={cell.key}
                    data-level={day.isFuture ? undefined : day.level}
                    data-today={day.isToday || undefined}
                    data-future={day.isFuture || undefined}
                    aria-pressed={cell.key === selectedKey}
                    aria-label={label}
                    disabled={day.isFuture}
                    tabIndex={cell.key === rovingKey ? 0 : -1}
                    style={{ gridColumnStart: cell.col + 1, gridRowStart: cell.row + 1 }}
                    onClick={() => {
                      setFocusKey(cell.key)
                      onSelect(day)
                    }}
                    onKeyDown={(event) => onKeyDown(event, cell.index)}
                    onMouseEnter={(event) => showTooltip(day, event.currentTarget)}
                    onFocus={(event) => showTooltip(day, event.currentTarget)}
                    onBlur={() => setTooltip(null)}
                  >
                    {mode !== 'year' && (
                      <span className="contribution-date" aria-hidden="true">
                        {mode === 'week' ? `${WEEKDAY_LABELS[day.weekday]} ${Number(cell.key.slice(8, 10))}` : Number(cell.key.slice(8, 10))}
                      </span>
                    )}
                    {mode === 'week' && day.connectionSeconds > 0 && !day.isFuture && (
                      <span className="contribution-time" aria-hidden="true">
                        {duration(day.connectionSeconds)}
                      </span>
                    )}
                    {day.isToday && <span className="contribution-today" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {tooltip && (
        <span className="contribution-tooltip" role="presentation" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.lines.map((line, index) => (
            <span key={index} className={index === 0 ? 'contribution-tooltip-date' : undefined}>
              {line}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}
