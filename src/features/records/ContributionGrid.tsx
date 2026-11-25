import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
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
import {
  flipTransform,
  GRID_CELL_RADIUS,
  GRID_MORPH_EASING,
  GRID_MORPH_MS,
  GRID_SLIDE_MS,
  GRID_SLIDE_PX,
  gridMotion,
  type Box,
  type GridSnapshot,
} from './grid-morph'
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

type Snapshot = {
  meta: GridSnapshot
  /** The grid's own height (border box). */
  height: number
  /** Each day's box relative to the grid, with what a ghost needs to look like it. */
  cells: Map<string, Box & { level: string | undefined }>
}

/** A future day's resting opacity (contribution-grid.css `[data-future]`). */
const FUTURE_OPACITY = 0.32

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * 내 기록 2D: the contribution grid (contribution-grid.ts). A cell per day, shaded by the day's time together; hover or
 * focus shows the date and the time (with 「전체」 each mate's time too), a press reports the day (the page opens its
 * record card). Arrow keys move between days (one tab stop); future days are disabled. Also the board when WebGL is
 * missing. Between periods the days morph (grid-morph.ts): the same day moves to its new box, new days fade in, leaving
 * days fade out, the height follows; the arrows slide. Reduced motion: no motion.
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

  // ── Period motion (grid-morph.ts) ──
  const frameRef = useRef<HTMLDivElement>(null)
  const snapshot = useRef<Snapshot | null>(null)
  const running = useRef<{ animations: Animation[]; cleanup: () => void } | null>(null)
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const frame = frameRef.current
    if (!wrap || !frame) return
    const meta: GridSnapshot = { mode, firstKey: days[0]?.key ?? '', lastKey: days.at(-1)?.key ?? '' }
    // The same days again (the period's records arrived, another mate): a running motion carries on, its target is
    // already the snapshot.
    if (running.current && snapshot.current && gridMotion(snapshot.current.meta, meta) === 'none') return
    // A motion still running ends now: its cells must be measured where they will rest.
    running.current?.animations.forEach((animation) => animation.cancel())
    running.current?.cleanup()
    running.current = null
    const measure = (): Snapshot => {
      const origin = wrap.getBoundingClientRect()
      const cells = new Map<string, Box & { level: string | undefined }>()
      days.forEach((day, index) => {
        const element = buttons.current[index]
        if (!element) return
        const rect = element.getBoundingClientRect()
        cells.set(day.key, { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height, level: element.dataset.level })
      })
      return { meta, height: origin.height, cells }
    }
    const previous = snapshot.current
    const next = measure()
    snapshot.current = next
    const motion = gridMotion(previous?.meta ?? null, next.meta)
    if (!previous || motion === 'none' || prefersReducedMotion()) return

    const animations: Animation[] = []
    const cleanups: (() => void)[] = []
    if (previous.height !== next.height) {
      animations.push(wrap.animate([{ height: `${previous.height}px` }, { height: `${next.height}px` }], {
        duration: motion === 'morph' ? GRID_MORPH_MS : GRID_SLIDE_MS,
        easing: GRID_MORPH_EASING,
      }))
    }
    if (motion === 'morph') {
      wrap.dataset.morphing = ''
      cleanups.push(() => delete wrap.dataset.morphing)
      const options = { duration: GRID_MORPH_MS, easing: GRID_MORPH_EASING }
      days.forEach((day, index) => {
        const element = buttons.current[index]
        const box = next.cells.get(day.key)
        if (!element || !box) return
        const old = previous.cells.get(day.key)
        // A day in both periods moves from its old box; a new day fades in as the others land.
        if (old) animations.push(element.animate([{ transform: flipTransform(old, box) }, { transform: 'none' }], options))
        else {
          // Explicit end value (a future day rests faded, contribution-grid.css): an implicit one is not held through
          // the delay.
          const rest = element.dataset.future === undefined ? 1 : FUTURE_OPACITY
          animations.push(element.animate([{ opacity: 0 }, { opacity: rest }], { duration: 420, delay: GRID_MORPH_MS - 420, easing: 'ease-out', fill: 'backwards' }))
        }
      })
      // Days that leave: still shapes where they were, fading out.
      const ghosts = document.createElement('div')
      ghosts.className = 'contribution-ghosts'
      ghosts.setAttribute('aria-hidden', 'true')
      for (const [key, box] of previous.cells) {
        if (next.cells.has(key)) continue
        const ghost = document.createElement('span')
        ghost.className = 'contribution-ghost'
        if (box.level !== undefined) ghost.dataset.level = box.level
        Object.assign(ghost.style, {
          left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
          borderRadius: `${GRID_CELL_RADIUS[previous.meta.mode]}px`,
        })
        ghosts.append(ghost)
      }
      if (ghosts.childElementCount) {
        wrap.append(ghosts)
        animations.push(ghosts.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' }))
        cleanups.push(() => ghosts.remove())
      }
    } else {
      const sign = motion === 'slide-next' ? 1 : -1
      animations.push(frame.animate(
        [{ transform: `translateX(${sign * GRID_SLIDE_PX}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: GRID_SLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      ))
    }
    const cleanup = () => cleanups.splice(0).forEach((fn) => fn())
    const current = { animations, cleanup }
    running.current = current
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (running.current !== current) return
      cleanup()
      running.current = null
    })
  }, [layout, days, mode])
  useEffect(() => () => {
    running.current?.animations.forEach((animation) => animation.cancel())
    running.current?.cleanup()
  }, [])
  // The width changes the boxes: measure again (never in the middle of a motion).
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (running.current || !snapshot.current) return
      const origin = wrap.getBoundingClientRect()
      const cells = new Map(snapshot.current.cells)
      days.forEach((day, index) => {
        const element = buttons.current[index]
        if (!element) return
        const rect = element.getBoundingClientRect()
        cells.set(day.key, { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height, level: element.dataset.level })
      })
      snapshot.current = { ...snapshot.current, height: origin.height, cells }
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [days])

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
        <div ref={frameRef} className="contribution-frame" style={style}>
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
