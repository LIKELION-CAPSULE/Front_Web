import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CapsuleCalendar } from '../CapsuleCalendar'
import { capsuleNeighbor, capsuleTooltip, type CapsuleDay } from '../capsule-calendar'
import type { CapsuleBoardModel } from './capsule-board-layout'
import type { BoardBenchmark, BoardSceneController } from './capsule-board-scene'
import './capsule-board.css'

/** Whether this browser can draw the board (else the 2D capsule calendar stands in). */
function supportsWebGL() {
  try {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}

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
 * 「함께 쌓은 시간」 board: the 2.5D scene (its own lazy chunk) plus everything that is not WebGL — the tooltip, the
 * keyboard and screen-reader day list (a visually hidden group of day buttons; the focused day lights up on the
 * board), and the 2D capsule calendar when WebGL is missing or fails.
 */
export function CapsuleBoard({
  model,
  selectedKey,
  onSelect,
  reducedMotion: forceReducedMotion = false,
  replayToken = 0,
  onController,
}: {
  model: CapsuleBoardModel
  selectedKey: string | undefined
  onSelect: (day: CapsuleDay) => void
  /** Forces reduced motion on top of the system setting (the preview's switch). */
  reducedMotion?: boolean
  /** Changing it plays the rise again. */
  replayToken?: number
  /** Development hook (benchmark). */
  onController?: (controller: { benchmark: (durationMs: number) => Promise<BoardBenchmark> } | null) => void
}) {
  const systemReducedMotion = usePrefersReducedMotion()
  const reducedMotion = forceReducedMotion || systemReducedMotion
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BoardSceneController | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [fallback, setFallback] = useState(() => !supportsWebGL())
  const [ready, setReady] = useState(false)
  const [aspect, setAspect] = useState(2.2)
  const [pointed, setPointed] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const modelRef = useRef(model)
  const onSelectRef = useRef(onSelect)
  const shownRef = useRef<number | null>(null)
  // Latest values for the scene's callbacks (the scene is created once).
  useLayoutEffect(() => {
    modelRef.current = model
    onSelectRef.current = onSelect
    shownRef.current = pointed ?? focused
  })

  const placeTooltip = useCallback(() => {
    const index = shownRef.current
    const scene = sceneRef.current
    const day = index === null ? undefined : modelRef.current.tiles[index]?.day
    if (index === null || !scene || !day) {
      setTooltip(null)
      return
    }
    const point = scene.tilePoint(index)
    if (!point) return
    setTooltip((current) =>
      current && current.text === capsuleTooltip(day) && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5
        ? current
        : { text: capsuleTooltip(day), x: point.x, y: point.y },
    )
  }, [])

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
          onHover: (index) => setPointed(index),
          onSelect: (index) => {
            const day = modelRef.current.tiles[index]?.day
            if (day) onSelectRef.current(day)
          },
          onFrame: placeTooltip,
          onAspect: setAspect,
        })
        sceneRef.current = controller
        onController?.({ benchmark: (ms) => controller!.benchmark(ms) })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setFallback(true)
      })
    return () => {
      cancelled = true
      controller?.dispose()
      sceneRef.current = null
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
    // The scene clears its hover (and reports it) when the board changes.
    sceneRef.current?.setBoard(model, { animate: true })
  }, [model, ready])

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion, ready])

  useEffect(() => {
    if (replayToken) sceneRef.current?.replay()
  }, [replayToken])

  const selectedIndex = selectedKey ? model.tiles.findIndex((tile) => tile.day.key === selectedKey) : -1
  useEffect(() => {
    sceneRef.current?.setSelected(selectedIndex >= 0 ? selectedIndex : null)
  }, [selectedIndex, ready, model])

  useEffect(() => {
    sceneRef.current?.setActive(focused)
  }, [focused])

  useEffect(placeTooltip, [pointed, focused, placeTooltip])

  // ── Keyboard: the same moves as the capsule calendar ──
  const days = model.calendar.days
  const rovingKey = focusKey ?? selectedKey ?? days.find((day) => !day.isFuture)?.key
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = capsuleNeighbor(model.mode, index, event.key, days)
    if (next === null) return
    event.preventDefault()
    const day = days[next]
    if (!day) return
    setFocusKey(day.key)
    buttons.current[next]?.focus()
  }

  if (fallback) {
    return (
      <div className="capsule-board capsule-board--fallback" data-board-fallback>
        <CapsuleCalendar data={model.calendar} selectedKey={selectedKey} onSelect={onSelect} />
      </div>
    )
  }

  return (
    <div
      className="capsule-board"
      data-mode={model.mode}
      data-focus={focused !== null || undefined}
      style={{ '--board-aspect': aspect } as CSSProperties}
      onMouseLeave={() => setPointed(null)}
    >
      <div ref={hostRef} className="capsule-board-stage" />
      {tooltip && (
        <span className="capsule-board-tooltip" role="presentation" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </span>
      )}
      <div className="sr-only" role="group" aria-label="함께 쌓은 시간 날짜 목록. 방향키로 날짜를 옮기고 Enter로 엽니다.">
        {days.map((day, index) => (
          <button
            key={day.key}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            data-board-day={day.key}
            aria-label={capsuleTooltip(day)}
            aria-pressed={day.key === selectedKey}
            disabled={day.isFuture}
            tabIndex={day.key === rovingKey ? 0 : -1}
            onFocus={() => {
              setFocusKey(day.key)
              setFocused(index)
            }}
            onBlur={() => setFocused((current) => (current === index ? null : current))}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onSelect(day)}
          />
        ))}
      </div>
    </div>
  )
}
