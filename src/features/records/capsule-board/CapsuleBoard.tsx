import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CapsuleCalendar, CapsuleLegend } from '../CapsuleCalendar'
import { capsuleNeighbor, capsuleTooltip, type CapsuleDay } from '../capsule-calendar'
import type { CommentHighlight } from '../mate-comment'
import { boardMonthTooltip, isMonthSelectable, type CapsuleBoardModel } from './capsule-board-layout'
import type { BoardBenchmark, BoardSceneController, BoardTarget } from './capsule-board-scene'
import {
  BOARD_NARROW_STAGE,
  boardStageAspect,
  boardTransition,
  supportsWebGL,
  yearMonthNeighbor,
  type BoardEmphasisControl,
  type BoardView,
} from './capsule-board-view'
import './capsule-board.css'

function usePrefersReducedMotion() {
  const [value, setValue] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setValue(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return value
}

/**
 * 「함께 쌓은 시간」 board: the WebGL scene (its own lazy chunk) plus everything that is not WebGL — the tooltip, the
 * keyboard and screen-reader list (days; the year's twelve months), and the 2D capsule calendar when WebGL is missing.
 */
export function CapsuleBoard({
  model,
  view,
  selectedKey,
  onSelectDay,
  onSelectMonth,
  emphasis,
  onEmphasisControl,
  onStageWidth,
  onFallback,
  reducedMotion: forceReducedMotion = false,
  replayToken = 0,
  onController,
}: {
  model: CapsuleBoardModel
  view: BoardView
  selectedKey: string | undefined
  onSelectDay: (day: CapsuleDay) => void
  /** Year view: a month board was chosen (0-based month). */
  onSelectMonth: (month: number) => void
  /** Days the mate's comment speaks about (null: none). */
  emphasis: CommentHighlight | null
  /** Receives the handle the comment's typing progress goes through (null on unmount). */
  onEmphasisControl?: (control: BoardEmphasisControl | null) => void
  /** The stage width (the page picks the narrow arrangement from it). */
  onStageWidth?: (width: number) => void
  onFallback?: () => void
  reducedMotion?: boolean
  replayToken?: number
  /** Development hook (benchmark). */
  onController?: (controller: { benchmark: (durationMs: number) => Promise<BoardBenchmark> } | null) => void
}) {
  const systemReducedMotion = usePrefersReducedMotion()
  const reducedMotion = forceReducedMotion || systemReducedMotion
  const wrapRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BoardSceneController | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [fallback, setFallback] = useState(() => !supportsWebGL())
  const [ready, setReady] = useState(false)
  const [stageWidth, setStageWidth] = useState(0)
  const [pointed, setPointed] = useState<BoardTarget | null>(null)
  const [focused, setFocused] = useState<BoardTarget | null>(null)
  // A focus left over from the other kind of list (a month after entering it, a day of another period) is void.
  const activeFocus =
    focused &&
    (focused.kind === 'month'
      ? model.mode === 'year'
      : model.mode !== 'year' && model.tiles.some((tile) => tile.day.key === focused.key))
      ? focused
      : null
  /** Set when a month was opened from the keyboard: its days' list takes the focus once it shows. */
  const focusIntoMonth = useRef(false)
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  /** 「가장 긴 날」 above the period's longest day in the week / month 2.5D (hidden while its own tooltip shows). */
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null)
  const modelRef = useRef(model)
  const handlers = useRef({ onSelectDay, onSelectMonth })
  const shownRef = useRef<BoardTarget | null>(null)
  const lastProgress = useRef<{ progress: number; finished: boolean } | null>(null)
  const previousModel = useRef<CapsuleBoardModel | null>(null)
  // Latest values for the scene's callbacks (the scene is created once).
  useLayoutEffect(() => {
    modelRef.current = model
    handlers.current = { onSelectDay, onSelectMonth }
    shownRef.current = pointed ?? activeFocus
  })

  const textFor = useCallback((target: BoardTarget) => {
    const current = modelRef.current
    if (target.kind === 'month') {
      const month = current.months[target.month]
      return month ? boardMonthTooltip(month) : null
    }
    const day = current.tiles.find((tile) => tile.day.key === target.key)?.day
    return day ? capsuleTooltip(day) : null
  }, [])

  const placeMarker = useCallback(() => {
    const scene = sceneRef.current
    const key = scene?.markedDay() ?? null
    const shown = shownRef.current
    const point = key && scene && !(shown?.kind === 'day' && shown.key === key) ? scene.targetPoint({ kind: 'day', key }) : null
    setMarker((current) =>
      current && point && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5 ? current : point,
    )
  }, [])

  const placeTooltip = useCallback(() => {
    placeMarker()
    const target = shownRef.current
    const scene = sceneRef.current
    const text = target ? textFor(target) : null
    if (!target || !scene || !text) {
      setTooltip(null)
      return
    }
    const point = scene.targetPoint(target)
    if (!point) return
    setTooltip((current) =>
      current && current.text === text && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5
        ? current
        : { text, x: point.x, y: point.y },
    )
  }, [textFor, placeMarker])

  // The comment's typing progress (kept until the scene exists).
  useEffect(() => {
    if (!onEmphasisControl) return
    onEmphasisControl({
      setProgress(progress, finished) {
        lastProgress.current = { progress, finished }
        sceneRef.current?.setEmphasisProgress(progress, finished)
      },
    })
    return () => onEmphasisControl(null)
  }, [onEmphasisControl])

  // Stage width (narrow arrangement and aspect).
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0)
      setStageWidth(width)
      onStageWidth?.(width)
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [onStageWidth, fallback])

  // ── Scene lifecycle (lazy chunk; disposed on unmount) ──
  useEffect(() => {
    if (fallback) return
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let controller: BoardSceneController | null = null
    import('./capsule-board-scene')
      .then(({ createCapsuleBoardScene }) => {
        if (cancelled) return
        controller = createCapsuleBoardScene({
          host,
          reducedMotion,
          view,
          onHover: setPointed,
          onSelect: (target) => {
            if (target.kind === 'month') {
              if (isMonthSelectable(modelRef.current, target.month)) handlers.current.onSelectMonth(target.month)
            }
            else {
              const day = modelRef.current.tiles.find((tile) => tile.day.key === target.key)?.day
              if (day) handlers.current.onSelectDay(day)
            }
          },
          onFrame: placeTooltip,
          onContextFailure: () => {
            setFallback(true)
            onFallback?.()
          },
        })
        sceneRef.current = controller
        onController?.({ benchmark: (ms) => controller!.benchmark(ms) })
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setFallback(true)
        onFallback?.()
      })
    return () => {
      cancelled = true
      controller?.dispose()
      sceneRef.current = null
      previousModel.current = null
      onController?.(null)
    }
    // The scene is created once; later changes go through the controller below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback])

  // Pause when hidden or off-screen.
  useEffect(() => {
    const host = hostRef.current
    if (!host || !ready) return
    let visible = true
    const update = () => sceneRef.current?.setRunning(visible && document.visibilityState === 'visible')
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      update()
    })
    observer.observe(host)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return
    if (previousModel.current === model) return
    const transition = boardTransition(previousModel.current, model)
    previousModel.current = model
    sceneRef.current?.setBoard(model, transition)
  }, [model, ready])

  useEffect(() => {
    sceneRef.current?.setView(view, true)
  }, [view, ready])

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion, ready])

  useEffect(() => {
    placeMarker()
  }, [ready, placeMarker])

  useEffect(() => {
    if (replayToken) sceneRef.current?.replay()
  }, [replayToken])

  useEffect(() => {
    sceneRef.current?.setSelected(selectedKey ?? null)
  }, [selectedKey, ready, model])

  const emphasisKey = emphasis ? `${emphasis.days.join(',')}|${emphasis.streak.join(',')}` : ''
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setEmphasis({ days: emphasis?.days ?? [], streak: emphasis?.streak ?? [] })
    const last = lastProgress.current
    if (last) scene.setEmphasisProgress(last.progress, last.finished)
    // The key stands for the emphasis' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emphasisKey, ready])

  useEffect(() => {
    sceneRef.current?.setActive(activeFocus)
  }, [activeFocus])

  useEffect(placeTooltip, [pointed, activeFocus, placeTooltip])

  // ── Keyboard: days (the capsule calendar's moves) or the year's months (←→ one, ↑↓ one row) ──
  const yearMode = model.mode === 'year'
  const days = model.calendar.days
  const items = yearMode
    ? model.months.map((month) => ({ key: month.key, label: boardMonthTooltip(month), disabled: !isMonthSelectable(model, month.month) }))
    : days.map((day) => ({ key: day.key, label: capsuleTooltip(day), disabled: day.isFuture }))
  const selectedMonthKey = selectedKey?.slice(0, 7)
  const rovingKey =
    (focusKey && items.some((item) => item.key === focusKey) ? focusKey : undefined) ??
    (yearMode ? items.find((item) => item.key === selectedMonthKey)?.key : selectedKey) ??
    items.find((item) => !item.disabled)?.key
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null
    if (yearMode) next = yearMonthNeighbor(index, event.key, model.yearColumns, items.findLastIndex((item) => !item.disabled))
    else next = capsuleNeighbor(model.mode, index, event.key, days)
    if (next === null) return
    event.preventDefault()
    const item = items[next]
    if (!item) return
    setFocusKey(item.key)
    // The list is visually hidden: moving in it must not scroll the page (the board shows the focus).
    buttons.current[next]?.focus({ preventScroll: true })
  }

  // Entered a month from the year by keyboard: focus its selected day (else the first that can be chosen) without
  // scrolling the page, so the keyboard user keeps their place.
  useEffect(() => {
    if (!focusIntoMonth.current || model.mode !== 'month') return
    focusIntoMonth.current = false
    const days = model.calendar.days
    const selected = days.findIndex((day) => day.key === selectedKey && !day.isFuture)
    const index = selected >= 0 ? selected : days.findIndex((day) => !day.isFuture)
    buttons.current[index]?.focus({ preventScroll: true })
  }, [model, selectedKey])

  const narrow = stageWidth > 0 && stageWidth < BOARD_NARROW_STAGE

  if (fallback) {
    return (
      <div className="capsule-board capsule-board--fallback" data-board-fallback data-tour="records-board">
        <CapsuleLegend mode={model.calendar.mode} showKeepsake={model.hasKeepsake} />
        <CapsuleCalendar data={model.calendar} selectedKey={selectedKey} onSelect={onSelectDay} />
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="capsule-board"
      data-tour="records-board"
      data-mode={model.mode}
      data-view={view}
      data-focus={activeFocus !== null || undefined}
      data-narrow={narrow || undefined}
      style={{ '--board-aspect': boardStageAspect(model.mode, view, narrow) } as CSSProperties}
      onMouseLeave={() => setPointed(null)}
    >
      <div ref={hostRef} className="capsule-board-stage" />
      {tooltip && (
        <span className="capsule-board-tooltip" role="presentation" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </span>
      )}
      {marker && (
        <span className="capsule-board-marker" aria-hidden="true" style={{ left: marker.x, top: marker.y }}>
          가장 긴 날
        </span>
      )}
      <div
        className="sr-only capsule-board-keys"
        role="group"
        aria-label={
          yearMode
            ? '함께 쌓은 시간 달 목록. 방향키로 달을 옮기고 Enter로 그 달을 크게 봅니다.'
            : '함께 쌓은 시간 날짜 목록. 방향키로 날짜를 옮기고 Enter로 엽니다.'
        }
      >
        {items.map((item, index) => (
          <button
            key={item.key}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            data-board-day={yearMode ? undefined : item.key}
            data-board-month={yearMode ? item.key : undefined}
            aria-label={item.label}
            aria-pressed={yearMode ? undefined : item.key === selectedKey}
            disabled={item.disabled}
            tabIndex={item.key === rovingKey ? 0 : -1}
            onFocus={() => {
              setFocusKey(item.key)
              setFocused(yearMode ? { kind: 'month', month: index } : { kind: 'day', key: item.key })
            }}
            onBlur={() => setFocused(null)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={(event) => {
              if (item.disabled) return
              if (yearMode) {
                // Enter / Space (no pointer position): the month's days take the focus once they show.
                focusIntoMonth.current = event.detail === 0
                onSelectMonth(index)
              }
              else {
                const day = days[index]
                if (day) onSelectDay(day)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}
