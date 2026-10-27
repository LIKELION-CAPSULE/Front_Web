import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { duration } from '@/shared/lib/format'
import type { studyHeatmap } from '../heatmap-data'
import './study-heatmap.css'

type Data = ReturnType<typeof studyHeatmap>
type Cell = Data['cells'][number]

/** An original contribution grid: daily time, keyboard navigation and a shared interactive scale. */
export function StudyHeatmap({
  data,
  selected,
  onSelect,
}: {
  data: Data
  selected: string
  onSelect: (day: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ day: string; left: number; top: number } | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const tooltipId = useId()
  const hovered = data.cells.find((cell) => cell.day === hover?.day)
  function show(cell: Cell, target: HTMLButtonElement) {
    const root = rootRef.current!.getBoundingClientRect(),
      box = target.getBoundingClientRect()
    setHover({
      day: cell.day,
      left: Math.max(0, Math.min(root.width - 176, box.left - root.left + box.width / 2 - 88)),
      top: Math.max(0, box.top - root.top - 52),
    })
  }
  function move(event: KeyboardEvent<HTMLButtonElement>, cell: Cell) {
    const index = data.cells.indexOf(cell)
    const steps: Record<string, number> = {
      ArrowRight: data.annual ? 7 : 1,
      ArrowLeft: data.annual ? -7 : -1,
      ArrowDown: data.annual ? 1 : 7,
      ArrowUp: data.annual ? -1 : -7,
    }
    const target =
      event.key === 'Home'
        ? data.cells.find((item) => !item.disabled)
        : event.key === 'End'
          ? data.cells.findLast((item) => !item.disabled)
          : event.key in steps
            ? data.cells[index + steps[event.key]!]
            : undefined
    if (!target || target.disabled) return
    event.preventDefault()
    onSelect(target.day)
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-day="${target.day}"]`)?.focus()
  }
  const style = { '--heatmap-columns': data.columns, '--heatmap-rows': data.rows } as CSSProperties
  return (
    <div
      ref={rootRef}
      className={`study-heatmap${data.annual ? ' study-heatmap--year' : ''}`}
      style={style}
      data-hovering={!!hover}
      data-highlight-level={level ?? undefined}
    >
      <div
        className="heatmap-scroll"
        tabIndex={data.annual ? 0 : undefined}
        role="region"
        aria-label={data.annual ? '연간 공부 히트맵' : '공부 시간 히트맵'}
        onScroll={() => setHover(null)}
      >
        {data.annual ? (
          <div className="heatmap-months" aria-hidden="true">
            {data.cells
              .filter((cell) => cell.day.endsWith('-01'))
              .map((cell) => (
                <span
                  key={cell.day}
                  style={{
                    gridColumn: `${cell.column + 1} / span ${Math.min(4, data.columns - cell.column)}`,
                  }}
                >
                  {Number(cell.day.slice(5, 7))}월
                </span>
              ))}
          </div>
        ) : (
          <div className="heatmap-weekdays" aria-hidden="true">
            {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        )}
        <div className="heatmap-body">
          {data.annual && (
            <div className="heatmap-y-axis" aria-hidden="true">
              {['월', '', '수', '', '금', '', '일'].map((day, i) => (
                <span key={i}>{day}</span>
              ))}
            </div>
          )}
          <div
            className="heatmap-cells"
            role="group"
            aria-label="날짜별 공부 기록"
            onPointerLeave={() => setHover(null)}
          >
            {data.cells.map((cell) => (
              <button
                key={cell.day}
                type="button"
                className="heatmap-cell"
                data-day={cell.day}
                data-level={cell.level}
                data-selected={selected === cell.day}
                data-active={hover?.day === cell.day}
                disabled={cell.disabled}
                tabIndex={selected === cell.day ? 0 : -1}
                aria-pressed={selected === cell.day}
                aria-label={`${cell.day.replaceAll('-', '.')} · ${cell.seconds ? duration(cell.seconds) : '공부 기록 없음'}`}
                aria-describedby={hover?.day === cell.day ? tooltipId : undefined}
                style={
                  {
                    gridColumn: cell.column + 1,
                    gridRow: cell.row + 1,
                    '--heatmap-delay': `${Math.min(cell.column * 0.012 + cell.row * 0.016, 0.3)}s`,
                  } as CSSProperties
                }
                onPointerEnter={(event) => show(cell, event.currentTarget)}
                onFocus={(event) => show(cell, event.currentTarget)}
                onBlur={() => setHover(null)}
                onKeyDown={(event) => move(event, cell)}
                onClick={() => onSelect(cell.day)}
              >
                {!data.annual && <span>{Number(cell.day.slice(8))}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="heatmap-scale"
        role="group"
        aria-label="공부 시간 색상 범례"
        onPointerLeave={() => setLevel(null)}
      >
        <span>적게</span>
        {[0, 1, 2, 3, 4].map((value) => (
          <button
            key={value}
            type="button"
            data-level={value}
            aria-label={
              ['기록 없음', '30분 미만', '30분 이상', '1시간 이상', '1시간 30분 이상'][value]
            }
            onPointerEnter={() => setLevel(value)}
            onFocus={() => setLevel(value)}
            onBlur={() => setLevel(null)}
            onClick={() => setLevel((current) => (current === value ? null : value))}
            aria-pressed={level === value}
          />
        ))}
        <span>많이</span>
      </div>
      {hover && hovered && (
        <div
          id={tooltipId}
          role="tooltip"
          className="heatmap-tooltip"
          style={{ left: hover.left, top: hover.top }}
        >
          <span>{hovered.day.replaceAll('-', '.')}</span>
          <strong>{duration(hovered.seconds)}</strong>
        </div>
      )}
    </div>
  )
}
