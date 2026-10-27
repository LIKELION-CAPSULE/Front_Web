import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { duration } from '@/shared/lib/format'
import type { StudyRecord } from '@/features/demo/types'
import type { RecordRange } from '../record-period'
import { companionTimeSeries } from '../companion-time'
import './companion-time-chart.css'

const colors = ['#ba94f1', '#7bbdcc', '#e6ad97', '#a9bd82', '#999cde', '#d798b5']
const height = 248
const inset = { left: 42, right: 18, top: 18, bottom: 32 }
const plotHeight = height - inset.top - inset.bottom

export function CompanionTimeChart({
  records,
  characters,
  range,
}: {
  records: readonly StudyRecord[]
  characters: readonly { id: string; name: string }[]
  range: RecordRange
}) {
  const { buckets, series } = useMemo(
    () => companionTimeSeries(records, characters, range),
    [records, characters, range],
  )
  const [selection, setSelection] = useState<string[] | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [width, setWidth] = useState(640)
  const chartRef = useRef<HTMLDivElement>(null)
  const plotWidth = Math.max(1, width - inset.left - inset.right)
  useEffect(() => {
    if (!chartRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(180, entry.contentRect.width))
    })
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])
  const description = useId()
  const selected = selection ?? series.slice(0, 3).map((item) => item.id)
  const visible = series.filter((item) => selected.includes(item.id))
  const max = Math.max(
    1800,
    ...visible.flatMap((item) => item.points.map((point) => point.cumulativeSeconds ?? 0)),
  )
  const ceiling = Math.ceil(max / 1800) * 1800
  const x = (index: number) => inset.left + (index / Math.max(1, buckets.length - 1)) * plotWidth
  const y = (seconds: number) => inset.top + (1 - seconds / ceiling) * plotHeight
  const lastAvailable = buckets.findLastIndex((bucket) => !bucket.future)
  const current = active === null ? null : Math.min(active, lastAvailable)
  const tickStep = Math.max(1, Math.ceil((buckets.length - 1) / (width < 360 ? 3 : 5)))
  const color = (id: string) => colors[series.findIndex((item) => item.id === id) % colors.length]!
  return (
    <div className="companion-chart" ref={chartRef}>
      <div className="companion-chart-toolbar">
        <h2>캐릭터별 함께한 시간</h2>
        <div className="companion-chart-actions" role="group" aria-label="캐릭터 일괄 선택">
          <button
            type="button"
            disabled={visible.length === series.length}
            onClick={() => {
              setSelection(series.map((item) => item.id))
              setActive(null)
            }}
          >
            모두 선택
          </button>
          <button
            type="button"
            disabled={!visible.length}
            onClick={() => {
              setSelection([])
              setActive(null)
            }}
          >
            모두 해제
          </button>
        </div>
      </div>
      <div className="companion-chart-legend" role="group" aria-label="비교할 캐릭터">
        {series.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected.includes(item.id)}
            aria-label={`${item.name} 시간 비교`}
            style={{ '--series-color': color(item.id) } as CSSProperties}
            onClick={() => {
              setSelection(
                selected.includes(item.id)
                  ? selected.filter((id) => id !== item.id)
                  : [...selected, item.id],
              )
              setActive(null)
            }}
          >
            <CharacterAvatar characterId={item.id} />
            <span className="companion-chart-person">
              <strong>{item.name}</strong>
              <small>{duration(item.seconds)}</small>
            </span>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
      {visible.length ? (
        <div
          className="companion-chart-plot"
          role="group"
          aria-label="캐릭터별 누적 공부 시간 추이"
          aria-describedby={description}
          tabIndex={0}
          onFocus={() => setActive(Math.max(0, lastAvailable))}
          onBlur={() => setActive(null)}
          onPointerLeave={(event) => {
            if (event.currentTarget !== document.activeElement) setActive(null)
          }}
          onPointerMove={(event) => {
            if ((event.target as Element).closest('.companion-chart-tooltip')) return
            const rect = event.currentTarget.getBoundingClientRect()
            const chartX = ((event.clientX - rect.left) / rect.width) * width
            setActive(
              Math.min(
                lastAvailable,
                Math.max(0, Math.round(((chartX - inset.left) / plotWidth) * (buckets.length - 1))),
              ),
            )
          }}
          onKeyDown={(event) => {
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? lastAvailable
                  : event.key === 'ArrowLeft'
                    ? Math.max(0, (current ?? lastAvailable) - 1)
                    : event.key === 'ArrowRight'
                      ? Math.min(lastAvailable, (current ?? 0) + 1)
                      : null
            if (next === null) return
            event.preventDefault()
            setActive(next)
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${range.dateLabel} 캐릭터별 누적 공부 시간 라인차트`}
          >
            {[0, 0.5, 1].map((ratio) => (
              <g key={ratio} className="companion-chart-grid">
                <line
                  x1={inset.left}
                  x2={width - inset.right}
                  y1={y(ceiling * ratio)}
                  y2={y(ceiling * ratio)}
                />
                <text x={inset.left - 10} y={y(ceiling * ratio) + 3} textAnchor="end">
                  {(ceiling * ratio) / 3600 >= 1
                    ? `${Math.round((ceiling * ratio) / 360) / 10}h`
                    : `${Math.round((ceiling * ratio) / 60)}m`}
                </text>
              </g>
            ))}
            {buckets.map((bucket, index) =>
              index % tickStep === 0 || index === buckets.length - 1 ? (
                <text
                  className="companion-chart-tick"
                  key={bucket.key}
                  x={x(index)}
                  y={height - 7}
                  textAnchor="middle"
                >
                  {bucket.tick}
                </text>
              ) : null,
            )}
            {visible.map((item) => {
              const path = item.points
                .flatMap((point, index) =>
                  point.cumulativeSeconds === null
                    ? []
                    : [`${index === 0 ? 'M' : 'L'}${x(index)},${y(point.cumulativeSeconds)}`],
                )
                .join(' ')
              return (
                <path
                  key={item.id}
                  d={path}
                  stroke={color(item.id)}
                  className="companion-chart-line"
                  pathLength={1}
                />
              )
            })}
            {current !== null && (
              <g className="companion-chart-crosshair">
                <line x1={x(current)} x2={x(current)} y1={inset.top} y2={height - inset.bottom} />
                {visible.map((item) => (
                  <circle
                    key={item.id}
                    cx={x(current)}
                    cy={y(item.points[current]?.cumulativeSeconds ?? 0)}
                    r={4}
                    fill={color(item.id)}
                  />
                ))}
              </g>
            )}
          </svg>
          {current !== null && (
            <div
              role="tooltip"
              aria-live="polite"
              className="companion-chart-tooltip"
              style={{ [current > buckets.length / 2 ? 'right' : 'left']: '8%' }}
            >
              <strong>{buckets[current]?.label}</strong>
              <div className="companion-chart-tooltip-head" aria-hidden="true">
                <span>캐릭터</span>
                <span>{range.period === 'year' ? '해당 월' : '당일'}</span>
                <span>누적</span>
              </div>
              {visible.map((item) => (
                <p key={item.id}>
                  <span>
                    <i style={{ background: color(item.id) }} />
                    {item.name}
                  </span>
                  <small>{duration(item.points[current]?.seconds ?? 0)}</small>
                  <b>{duration(item.points[current]?.cumulativeSeconds ?? 0)}</b>
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="companion-chart-empty">
          {series.length ? '비교할 캐릭터를 골라 주세요.' : '아직 함께한 시간이 없어요.'}
        </p>
      )}
      <p id={description} className="sr-only">
        {range.label} 시작부터 각 날짜까지 쌓인 공부 시간이에요. 캐릭터 버튼으로 비교할 선을
        선택하고, 방향키 또는 Home과 End로 날짜를 이동할 수 있어요.
      </p>
    </div>
  )
}
