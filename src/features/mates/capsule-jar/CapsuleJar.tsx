import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type Ref } from 'react'
import { cn } from '@/shared/lib/cn'
import {
  capsuleJarSummary,
  formatCapsuleShortDate,
  formatCapsuleTimeRange,
  formatTogether,
  groupCapsulesByDay,
  totalCapsuleSeconds,
  withParticle,
} from './capsule-jar-data.ts'
import { CAPSULE_ASPECT } from './capsule-jar-layout.ts'
import { PILE, layoutFloor, pileHalfWidth, type FloorLayout } from './capsule-floor-layout.ts'
import { capsuleJarTheme } from './capsule-jar-theme.ts'
import type { CapsuleJarTheme, CapsuleRecord } from './capsule-jar-types.ts'
import type { JarBenchmark, JarSceneController, JarScenePoint } from './capsule-jar-scene.ts'
import { CapsuleRecordCard } from './CapsuleRecordCard.tsx'
import './capsule-jar.css'

/**
 * The mate panel of the my-mates page, in layers (bottom to top):
 * 1. the capsule pile (three.js canvas; three.js and the cannon-es physics load as their own chunks once the panel
 *    is on screen): a flat, side-on pile at the bottom, behind the mate. On entry the capsules pour down; clicking one
 *    that the mate does not cover opens its connection's record card.
 * 2. the mate (`mateLayer`, e.g. the big Live2D preview), transparent, letting pointer events through to the pile.
 *    Her still image's silhouette (alpha) decides what she covers, so clicks on her never pick a capsule behind her.
 * 3. the caption (`caption`: name, stage, first meeting), styled by the page (a dark glass box).
 * Two canvases (Live2D and three.js) instead of one shared GL context: each renderer keeps its own lifecycle and
 * pauses on its own when off screen. Mount one per mate (`key`).
 */

export type CapsuleJarHandle = {
  /** Sways the scene with a scripted pointer for `durationMs` and reports frame timing. */
  benchmark(durationMs: number): Promise<JarBenchmark | null>
  /** Opens a connection's record card from outside (e.g. the recent list); its capsules light up first. */
  openCapsule(id: string): void
  /** Lights a connection's capsules while it is pointed at outside the scene (null: none). */
  highlight(id: string | null): void
}

export type CapsuleJarProps = {
  mateId: string
  mateName: string
  /** Connections; each becomes a bundle of capsules (capsule-floor-layout.ts). */
  capsules: readonly CapsuleRecord[]
  /** Connections new since the last visit (see `useCapsuleVisit`): their capsules pour in last and sparkle. */
  dropIds?: readonly string[]
  /** Entry: the full one when the page opens, a short one after switching mates. */
  pour?: 'enter' | 'switch'
  /** The mate standing in front of the pile (transparent; pointer events go through to the capsules). */
  mateLayer?: ReactNode
  /** Text over the pile at the bottom (name, stage, first meeting). */
  caption?: ReactNode
  /**
   * The entry pour is over (or there is none: reduced motion, no physics, the 2D fallback). Called once per scene;
   * the page starts heavy work (the Live2D model) only then, so it never competes with the pour.
   */
  onSettled?: () => void
  /** Forces the still scene even when the OS does not ask for reduced motion (preview control). */
  forceReducedMotion?: boolean
  /** Forces the 2D fallback (preview / tests). */
  forceFallback?: boolean
  theme?: CapsuleJarTheme
  className?: string
  /** Standalone header with the list toggle (preview). The page renders its own controls beside the scene. */
  showHeader?: boolean
  /** Controlled 「목록으로 보기」. */
  listView?: boolean
  onListViewChange?: (listView: boolean) => void
  ref?: Ref<CapsuleJarHandle>
}

type RenderMode = 'pending' | 'webgl' | 'fallback'
type CardPlacement = 'beside' | 'sheet' | 'center'
type RecordCardState = {
  id: string
  /** Where the record card unfolds from (stage coordinates), when it came out of a capsule. */
  origin: JarScenePoint | null
  placement: CardPlacement
  phase: 'open' | 'closing'
  animated: boolean
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches))
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}

const CARD_CLOSE_MS = 240

export default function CapsuleJar({
  mateId,
  mateName,
  capsules,
  dropIds = [],
  pour = 'enter',
  mateLayer,
  caption,
  onSettled,
  forceReducedMotion = false,
  forceFallback = false,
  theme: themeOverride,
  className,
  showHeader = true,
  listView: listViewProp,
  onListViewChange,
  ref,
}: CapsuleJarProps) {
  const theme = useMemo(() => themeOverride ?? capsuleJarTheme(mateId), [themeOverride, mateId])
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const reducedMotion = forceReducedMotion || systemReduced
  // The pile spans the panel's width (in scene units, the panel is PILE.viewHeight high): measured from the stage.
  const [halfWidth, setHalfWidth] = useState<number>(PILE.defaultHalfWidth)
  const layout = useMemo(() => layoutFloor(capsules, { halfWidth }), [capsules, halfWidth])
  const byId = useMemo(() => new Map(capsules.map((capsule) => [capsule.id, capsule])), [capsules])
  const summary = capsuleJarSummary(mateName, capsules, layout.placements.length)
  const titleId = useId()

  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<JarSceneController | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hoveredRef = useRef<string | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  // Latest values for the long-lived scene (created asynchronously, after these may have changed).
  const latest = useRef({ layout, dropIds, reducedMotion })
  const mateRef = useRef<HTMLDivElement>(null)
  const mateCovers = useMateSilhouette(mateRef)
  /** Bumped when the scene goes away: a pending opening from an older scene must not open a record card. */
  const generationRef = useRef(0)
  /** New connections that have already fallen in this mount. */
  const pouredIds = useRef(new Set<string>())

  const [mode, setMode] = useState<RenderMode>(forceFallback ? 'fallback' : 'pending')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [recordCard, setRecordCard] = useState<RecordCardState | null>(null)
  const [opening, setOpening] = useState(false)
  const [ownListView, setOwnListView] = useState(false)
  const listView = listViewProp ?? ownListView
  const setListView = (value: boolean) => {
    if (listViewProp === undefined) setOwnListView(value)
    onListViewChange?.(value)
  }

  // The record's connection disappeared (records changed): the card closes with it.
  if (recordCard && !byId.has(recordCard.id)) setRecordCard(null)

  // The overlay follows the scene every rendered frame without React re-renders.
  const syncOverlay = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const hovered = hoveredRef.current
    const tooltip = tooltipRef.current
    if (tooltip) {
      const point = hovered ? scene.capsulePoint(hovered) : null
      if (point) tooltip.style.transform = `translate(${point.x}px, ${point.y}px)`
    }
  }, [])

  // The panel is tall and narrow: the record card opens over its middle (a sheet on narrow screens).
  // The record card settles in the middle of the window (a collectible card); narrow screens shrink it to fit.
  const placementFor = useCallback((): CardPlacement => 'center', [])

  const openRecord = useCallback(
    (id: string, origin: JarScenePoint | null, animated: boolean, placement: CardPlacement) => {
      const active = document.activeElement
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : stageRef.current
      setRecordCard({ id, origin, placement, phase: 'open', animated })
    },
    [],
  )

  const selectFromScene = useCallback(
    (id: string) => {
      const scene = sceneRef.current
      if (opening || recordCard) return
      const placement = placementFor()
      if (!scene || reducedMotion) {
        if (scene && placement === 'beside') scene.setBeside(true)
        openRecord(id, null, false, placement)
        return
      }
      setOpening(true)
      const generation = generationRef.current
      void scene.open(id, { beside: placement === 'beside' }).then((origin) => {
        if (generation !== generationRef.current) return
        setOpening(false)
        // Null: the opening was cancelled (the connection left the pile); nothing to show.
        if (origin) openRecord(id, origin, true, placement)
      })
    },
    [opening, recordCard, openRecord, placementFor, reducedMotion],
  )

  // Latest callbacks for the long-lived scene.
  const handlers = useRef({ selectFromScene, syncOverlay, onSettled })
  useEffect(() => {
    handlers.current = { selectFromScene, syncOverlay, onSettled }
    latest.current = { layout, dropIds, reducedMotion }
  }, [selectFromScene, syncOverlay, onSettled, layout, dropIds, reducedMotion])

  // Create the scene lazily, only once it scrolls into view; then the capsules pour.
  useEffect(() => {
    if (forceFallback) {
      handlers.current.onSettled?.()
      return
    }
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let loading = false
    let visible = false
    const updateRunning = () => sceneRef.current?.setRunning(visible && !document.hidden)
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      if (visible && !sceneRef.current && !loading) {
        loading = true
        Promise.all([
          import('./capsule-jar-scene.ts'),
          // Physics is optional: without it the scene shows its still final state.
          import('./capsule-physics.ts')
            .then((module) =>
              module.createCapsulePhysics({
                halfWidth: latest.current.layout.width / 2,
                binWalls: { at: [-PILE.binEdge, PILE.binEdge], height: PILE.binWallHeight, thickness: PILE.binWallThickness },
              }),
            )
            .catch(() => null),
        ])
          .then(([{ createCapsuleJarScene }, physics]) => {
            if (cancelled) {
              physics?.dispose()
              return
            }
            const current = latest.current
            const scene = createCapsuleJarScene({
              host,
              theme,
              reducedMotion: current.reducedMotion,
              physics,
              onHover: (id) => {
                hoveredRef.current = id
                setHoveredId(id)
              },
              onSelect: (id) => handlers.current.selectFromScene(id),
              onFrame: () => handlers.current.syncOverlay(),
              onIntroEnd: (kind) => {
                if (kind !== 'arrival') handlers.current.onSettled?.()
              },
            })
            sceneRef.current = scene
            scene.setOccluder(mateCovers)
            scene.setLayout(current.layout)
            for (const id of current.dropIds) pouredIds.current.add(id)
            scene.intro({ kind: pour, newGroupIds: current.dropIds })
            setMode('webgl')
            updateRunning()
          })
          .catch(() => {
            // WebGL unavailable (or the chunk failed to load): show the still 2D scene.
            if (!cancelled) {
              setMode('fallback')
              handlers.current.onSettled?.()
            }
          })
      }
      updateRunning()
    })
    observer.observe(host)
    document.addEventListener('visibilitychange', updateRunning)
    const generation = generationRef
    return () => {
      cancelled = true
      generation.current++
      observer.disconnect()
      document.removeEventListener('visibilitychange', updateRunning)
      // Settles a pending opening (null) before the scene goes.
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    // The scene is rebuilt only for a different mate colour; layout and motion updates go through the controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, forceFallback])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setLayout(layout)
    // Connections that arrive while the page is open fall in on their own.
    const fresh = dropIds.filter((id) => !pouredIds.current.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) pouredIds.current.add(id)
    scene.intro({ kind: 'arrival', newGroupIds: fresh })
  }, [layout, dropIds])

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  // The panel's shape sets the floor's width (before the scene starts, and again on resize).
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const rect = stage.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setHalfWidth(pileHalfWidth(rect.width / rect.height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Place the DOM overlay as soon as it mounts (a still scene renders no further frames).
  useLayoutEffect(() => {
    syncOverlay()
  }, [mode, layout, hoveredId, syncOverlay])

  const openFromOutside = useCallback(
    (id: string) => {
      if (!byId.has(id)) return
      if (listView || !sceneRef.current) {
        openRecord(id, null, false, placementFor())
        return
      }
      sceneRef.current.finishIntro()
      selectFromScene(id)
    },
    [byId, listView, openRecord, placementFor, selectFromScene],
  )

  useImperativeHandle(
    ref,
    () => ({
      benchmark: async (durationMs: number) => (sceneRef.current ? sceneRef.current.benchmark(durationMs) : null),
      openCapsule: openFromOutside,
      highlight: (id) => sceneRef.current?.setHighlight(id),
    }),
    [openFromOutside],
  )

  // ── Record card lifecycle ──
  const closeRecord = useCallback(() => {
    setRecordCard((current) => (current && current.phase === 'open' ? { ...current, phase: 'closing' } : current))
  }, [])

  useEffect(() => {
    if (!recordCard || recordCard.phase === 'open') return
    const delay = recordCard.animated && !reducedMotion ? CARD_CLOSE_MS : 0
    const timer = window.setTimeout(() => {
      setRecordCard(null)
      const target = returnFocusRef.current
      returnFocusRef.current = null
      void (sceneRef.current?.close() ?? Promise.resolve())
      target?.focus({ preventScroll: true })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [recordCard, reducedMotion])

  const hovered = hoveredId ? byId.get(hoveredId) : undefined
  const selected = recordCard ? byId.get(recordCard.id) : undefined
  const totalSeconds = totalCapsuleSeconds(capsules)
  const days = useMemo(() => groupCapsulesByDay(capsules), [capsules])

  const stageStyle = {
    '--jar-glow': theme.glow,
    '--jar-rim': theme.rim,
    '--jar-light': theme.lightHalf,
    '--jar-light-shade': theme.lightHalfShade,
    '--jar-tint': theme.tintHalf,
    '--jar-tint-shade': theme.tintHalfShade,
  } as CSSProperties

  return (
    <section
      className={cn('capsule-jar', !showHeader && 'capsule-jar--embedded', className)}
      aria-labelledby={showHeader ? titleId : undefined}
      aria-label={showHeader ? undefined : `${mateName}${withParticle(mateName)} 함께한 캡슐`}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
      style={stageStyle}
    >
      {showHeader && (
        <header className="capsule-jar-header">
          <div>
            <h2 id={titleId} className="capsule-jar-title">캡슐 보관함</h2>
            <p className="capsule-jar-meta">
              연결 {capsules.length.toLocaleString('ko-KR')}번 · 캡슐 {layout.placements.length.toLocaleString('ko-KR')}개
              <span aria-hidden="true"> · </span>
              함께한 시간 {formatTogether(totalSeconds)}
            </p>
          </div>
          <button type="button" className="capsule-jar-toggle" aria-pressed={listView} onClick={() => setListView(!listView)}>
            {listView ? '보관함으로 보기' : '목록으로 보기'}
          </button>
        </header>
      )}

      <div className="capsule-jar-body" data-card={recordCard ? recordCard.placement : undefined}>
        <div ref={stageRef} className="capsule-jar-stage" hidden={listView} tabIndex={-1} data-mode={mode}>
          {/* Decorative picture of the pile (canvas); its summary is the accessible name. The mate layer and caption are outside it. */}
          <div ref={hostRef} className="capsule-jar-host" role="img" aria-label={summary} />
          {mode === 'fallback' && (
            <FloorFallback
              layout={layout}
              theme={theme}
              onSelect={(id, event) => {
                if (!mateCovers(event.clientX, event.clientY)) openRecord(id, null, false, placementFor())
              }}
            />
          )}
          {mateLayer && (
            <div ref={mateRef} className="capsule-jar-mate">
              {mateLayer}
            </div>
          )}
          {caption && <div className="capsule-jar-caption">{caption}</div>}
          <p className="sr-only">키보드로는 「목록으로 보기」에서 날짜별 기록을 열 수 있어요.</p>

          {mode === 'webgl' && hovered && !recordCard && (
            <div ref={tooltipRef} className="capsule-jar-tooltip-anchor" aria-hidden="true">
              <div className="capsule-jar-tooltip">
                <span className="capsule-jar-tooltip-date">{formatCapsuleShortDate(hovered.startedAt)}</span>
                <span className="capsule-jar-tooltip-time">{formatTogether(hovered.durationSeconds)}</span>
              </div>
            </div>
          )}

          {capsules.length === 0 && (
            <div className="capsule-jar-welcome" data-count={0}>
              <p className="capsule-jar-welcome-title">첫 캡슐을 모아 볼까?</p>
              <p className="capsule-jar-welcome-text">
                {mateName}{withParticle(mateName)} 연결을 마치면 함께한 시간만큼 캡슐이 쏟아져요.
              </p>
            </div>
          )}
        </div>

        {listView && (
          <div className="capsule-jar-list">
            {days.length === 0 ? (
              <p className="capsule-jar-list-empty">아직 기록이 없어요.</p>
            ) : (
              days.map((group) => (
                <section key={group.day} className="capsule-jar-list-day" aria-label={group.day}>
                  <h3 className="capsule-jar-list-date">{group.day}</h3>
                  <ul>
                    {group.capsules.map((capsule) => (
                      <li key={capsule.id}>
                        <button
                          type="button"
                          className="capsule-jar-list-item"
                          onClick={() => openRecord(capsule.id, null, false, placementFor())}
                        >
                          <span className="capsule-jar-pill" aria-hidden="true" />
                          <span className="capsule-jar-list-text">{formatCapsuleTimeRange(capsule)}</span>
                          <span className="capsule-jar-list-duration">{formatTogether(capsule.durationSeconds)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}

        {recordCard && selected && (
          <CapsuleRecordCard
            capsule={selected}
            mateName={mateName}
            mateId={mateId}
            frame="viewport"
            placement={recordCard.placement}
            phase={recordCard.phase}
            animated={recordCard.animated && !reducedMotion}
            origin={recordCard.origin}
            getOriginFrame={() => stageRef.current}
            onClose={closeRecord}
          />
        )}
      </div>
    </section>
  )
}

/** Alpha of the mate's still, sampled at this size (enough for a click test, cheap to read). */
const SILHOUETTE_WIDTH = 160

/**
 * Whether the mate covers a viewport point: the alpha of her still image (the `<img>` in the mate layer, drawn in the
 * same framing as the live model and kept in layout even while hidden behind it), widened by one sample so the live
 * model's small sway stays covered. Without a readable image nothing is covered.
 */
function useMateSilhouette(mateRef: { current: HTMLElement | null }) {
  const mask = useRef<{ src: string; width: number; height: number; alpha: Uint8ClampedArray } | null>(null)
  return useCallback(
    (clientX: number, clientY: number) => {
      const image = mateRef.current?.querySelector('img')
      if (!image || !image.complete || !image.naturalWidth) return false
      const rect = image.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false
      const src = image.currentSrc || image.src
      if (mask.current?.src !== src) {
        try {
          const width = SILHOUETTE_WIDTH
          const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (!context) return false
          context.drawImage(image, 0, 0, width, height)
          const data = context.getImageData(0, 0, width, height).data
          const alpha = new Uint8ClampedArray(width * height)
          for (let index = 0; index < alpha.length; index++) alpha[index] = data[index * 4 + 3]!
          mask.current = { src, width, height, alpha }
        } catch {
          // A cross-origin image cannot be read: treat its whole box as the mate.
          mask.current = null
          return true
        }
      }
      const { width, height, alpha } = mask.current
      const u = Math.floor(((clientX - rect.left) / rect.width) * width)
      const v = Math.floor(((clientY - rect.top) / rect.height) * height)
      for (let dv = -1; dv <= 1; dv++) {
        for (let du = -1; du <= 1; du++) {
          const x = u + du
          const y = v + dv
          if (x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x]! > 48) return true
        }
      }
      return false
    },
    [mateRef],
  )
}

/**
 * Still 2D pile for browsers without WebGL: the same side-on pile as the scene, drawn as SVG at the bottom of the
 * panel (the mate layer and caption stay as they are). Decorative: hidden from assistive technology; 「목록으로 보기」
 * lists the records.
 */
function FloorFallback({
  layout,
  theme,
  onSelect,
}: {
  layout: FloorLayout
  theme: CapsuleJarTheme
  onSelect: (id: string, event: ReactMouseEvent) => void
}) {
  const gradientId = useId().replace(/:/g, '')
  // The scene's frame: the panel's width, the floor at the bottom edge.
  const half = layout.width / 2
  const top = Math.max(1.2, layout.topHeight + 0.4)
  return (
    <svg
      className="capsule-jar-fallback"
      viewBox={`${-half} ${-top} ${layout.width} ${top + 0.03}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${gradientId}-core`}>
          <stop stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor={theme.glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={theme.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      {layout.placements.map((placement) => {
        const thickness = placement.length * CAPSULE_ASPECT
        return (
          <g
            key={placement.id}
            transform={`translate(${placement.x} ${-placement.y}) rotate(${(-placement.pitch * 180) / Math.PI})`}
            className="capsule-jar-fallback-capsule"
            onClick={(event) => onSelect(placement.groupId, event)}
          >
            <rect x={-placement.length / 2} y={-thickness / 2} width={placement.length} height={thickness} rx={thickness / 2}
              fill={theme.lightHalf} fillOpacity="0.18" stroke={theme.lightHalf} strokeOpacity="0.45" strokeWidth={0.008} />
            <circle r={placement.length * (0.1 + 0.15 * placement.glow)} fill={`url(#${gradientId}-core)`} />
          </g>
        )
      })}
    </svg>
  )
}
