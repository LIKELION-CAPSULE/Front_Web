import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  DEFAULT_DESKTOP_CONTROLS,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { emitLoginDesktopEvent } from '@/features/auth/login-backgrounds/desktop/login-analytics'
import type { LoginMateProfile } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import { resolveGazeForState } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { AlivingRenderer } from '@/features/mate-render/AlivingRenderer'
import {
  computeAlivingLayerBox,
  computeAssembleCamera,
  computeFaceScreenPosition,
  computePointerGaze,
  modelPointToScreen,
} from '@/features/mate-render/aliving-view'
import { resolveMateSource } from '@/features/mate-render/mate-source'
import type { MateRenderStatus, MateRenderer } from '@/features/mate-render/types'
import {
  ASSEMBLE_APP_ICON_URL,
  CHAERIN_ASSEMBLE_MANIFEST,
  type RigJointId,
} from './assemble-assets'
import {
  ASSEMBLE_TIMINGS_MS,
  createInitialAssembleState,
  getAssembleStepDurationMs,
  readAssembleSeen,
  transitionAssembleState,
  writeAssembleSeen,
  type AssembleForcePhase,
  type AssembleMachineState,
  type AssembleMethod,
  type AssemblePhase,
  type Live2DReadiness,
} from './assemble-machine'
import './assemble.css'

/** Per-layer assembling timing (ms): back layers 130ms apart, facial features 55ms, front-hair +40ms & 260ms snap.
 * Face/mouth/eyes/lashes/brows cap mesh flash at 0.5 so the face never blows out white. */
const LAYER_ASSEMBLE_TIMING: Record<number, { delayMs: number; durationMs: number; meshPeak: number }> = {
  0: { delayMs: 0, durationMs: 320, meshPeak: 0.9 },    // back-hair
  1: { delayMs: 130, durationMs: 320, meshPeak: 0.9 },  // skirt
  2: { delayMs: 260, durationMs: 320, meshPeak: 0.9 },  // body
  3: { delayMs: 390, durationMs: 320, meshPeak: 0.5 },  // face
  4: { delayMs: 445, durationMs: 320, meshPeak: 0.5 },  // mouth
  5: { delayMs: 500, durationMs: 320, meshPeak: 0.5 },  // eyes
  6: { delayMs: 555, durationMs: 320, meshPeak: 0.5 },  // lashes
  7: { delayMs: 610, durationMs: 320, meshPeak: 0.5 },  // brows
  8: { delayMs: 650, durationMs: 260, meshPeak: 0.9 },  // front-hair
}

/** Ordered skeleton bone draw schedule during assembling (+150ms -> +600ms, 450ms total). */
const RIG_BONE_SCHEDULE: ReadonlyArray<{
  from: RigJointId
  to: RigJointId
  delayMs: number
  durationMs: number
}> = [
  { from: 'neck', to: 'head', delayMs: 150, durationMs: 130 },
  { from: 'neck', to: 'chest', delayMs: 150, durationMs: 140 },
  { from: 'chest', to: 'hip', delayMs: 270, durationMs: 160 },
  { from: 'neck', to: 'shoulderL', delayMs: 210, durationMs: 140 },
  { from: 'neck', to: 'shoulderR', delayMs: 210, durationMs: 140 },
  { from: 'shoulderL', to: 'elbowL', delayMs: 330, durationMs: 140 },
  { from: 'shoulderR', to: 'elbowR', delayMs: 330, durationMs: 140 },
  { from: 'elbowL', to: 'wristL', delayMs: 450, durationMs: 150 },
  { from: 'elbowR', to: 'wristR', delayMs: 450, durationMs: 150 },
]

/**
 * Visible joint circles (head & neck intentionally omitted — bones only on face/neck).
 * Delay matches the moment each bone reaches that joint during assembling.
 */
const VISIBLE_RIG_JOINTS: ReadonlyArray<{
  id: RigJointId
  delayMs: number
  sparkle: boolean
}> = [
  { id: 'chest', delayMs: 280, sparkle: false },
  { id: 'shoulderL', delayMs: 340, sparkle: true },
  { id: 'shoulderR', delayMs: 340, sparkle: true },
  { id: 'hip', delayMs: 420, sparkle: true },
  { id: 'elbowL', delayMs: 460, sparkle: true },
  { id: 'elbowR', delayMs: 460, sparkle: true },
  { id: 'wristL', delayMs: 590, sparkle: true },
  { id: 'wristR', delayMs: 590, sparkle: true },
]

/** Login reaction state -> chaerin-v2 (Aliving2D) expression name mapping. */
function mapReactionToV2Expression(state: MateReactionState): string | null {
  switch (state) {
    case 'greet':
      return 'happy'
    case 'emailFocus':
    case 'passwordFocus':
      return 'focus'
    case 'error':
      return 'sulky'
    case 'success':
      return 'laugh'
    default:
      return null
  }
}

function localStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function toReadiness(status: MateRenderStatus, hasAliving: boolean): Live2DReadiness {
  if (!hasAliving) return 'error'
  if (status === 'ready') return 'ready'
  if (status === 'error') return 'error'
  return 'loading'
}

export function AssembleMateStage({
  mate,
  allowLive2D,
  reducedMotion,
  reactionState,
  reactionNonce,
  forcePhase = null,
  disableEngine = false,
  onLiveEntered,
  onGreetBubbleReady,
  onPhaseChange,
}: {
  mate: LoginMateProfile
  allowLive2D: boolean
  reducedMotion: boolean
  reactionState: MateReactionState
  reactionNonce: number
  forcePhase?: AssembleForcePhase
  disableEngine?: boolean
  onLiveEntered?: () => void
  onGreetBubbleReady?: () => void
  onPhaseChange?: (phase: AssemblePhase, immediate: boolean) => void
}) {
  const stageMeasureRef = useRef<HTMLDivElement>(null)
  const engineHostRef = useRef<HTMLDivElement>(null)
  const cardBtnRef = useRef<HTMLButtonElement>(null)
  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const rendererRef = useRef<MateRenderer | null>(null)

  const resolvedSource = useMemo(() => {
    if (!allowLive2D || disableEngine || !mate.v2Model) return { kind: 'static' as const }
    return resolveMateSource(
      {
        modelUrl: mate.v2Model.modelJsonUrl,
        engineUrl: mate.v2Model.engineUrl,
        playerUrl: mate.v2Model.playerUrl,
        reactionsUrl: mate.v2Model.reactionsUrl,
      },
      {
        pageOrigin: typeof window !== 'undefined' ? window.location.origin : '',
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
      },
    )
  }, [allowLive2D, disableEngine, mate.v2Model])

  const hasAliving = resolvedSource.kind === 'aliving'
  const initialReadiness = toReadiness('loading', hasAliving)

  const [engineStatus, setEngineStatus] = useState<Live2DReadiness>(initialReadiness)
  const engineStatusRef = useRef<Live2DReadiness>(initialReadiness)

  const initialSeen = useMemo(() => readAssembleSeen(localStore()), [])
  const [machine, setMachine] = useState<AssembleMachineState>(() =>
    createInitialAssembleState({
      seen: initialSeen,
      live2dStatus: initialReadiness,
      forcePhase,
    }),
  )

  const [tileSize, setTileSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [isHalfScreen, setIsHalfScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 959,
  )
  // Camera pose & crossfade gate: starts in B (and crossfadeDone=true) on revisit, half-screen, reduced-motion, or forced live/static;
  // otherwise crossfades at Shot A with neutral face & center gaze (0,0), then after 260ms triggers happy + B zoom + cursor tracking.
  const immediateBInit =
    forcePhase === 'live' ||
    forcePhase === 'static' ||
    (forcePhase === null && (initialSeen || reducedMotion)) ||
    (typeof window !== 'undefined' && window.innerWidth <= 959)
  const [cameraInB, setCameraInB] = useState<boolean>(immediateBInit)
  const [crossfadeDone, setCrossfadeDone] = useState<boolean>(immediateBInit)

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dropHover, setDropHover] = useState(false)
  const [showDemoCursor, setShowDemoCursor] = useState(false)
  /** If FPS drops below 50 during exploding, omit vertex dots on back-hair & body (edges only). */
  const [omitHeavyVerts, setOmitHeavyVerts] = useState(false)
  /** Premount poly.svg elements while idle via requestIdleCallback so meshing has zero mount spike. */
  const [polyPremounted, setPolyPremounted] = useState(false)

  const demoPlayedRef = useRef(false)
  const completedEmittedRef = useRef(false)
  const skipCameraMoveRef = useRef(
    forcePhase === 'live' || forcePhase === 'static' || (forcePhase === null && initialSeen),
  )
  const onLiveEnteredRef = useRef(onLiveEntered)
  const onGreetBubbleReadyRef = useRef(onGreetBubbleReady)
  const onPhaseChangeRef = useRef(onPhaseChange)
  useEffect(() => {
    onLiveEnteredRef.current = onLiveEntered
  }, [onLiveEntered])
  useEffect(() => {
    onGreetBubbleReadyRef.current = onGreetBubbleReady
  }, [onGreetBubbleReady])
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange
  }, [onPhaseChange])

  // Notify parent whenever assemble phase changes (used to toggle the top-left AI caption)
  useEffect(() => {
    const immediate =
      skipCameraMoveRef.current || reducedMotion || machine.reducedMotion || forcePhase === 'live' || forcePhase === 'static'
    onPhaseChangeRef.current?.(machine.phase, immediate)
  }, [machine.phase, machine.reducedMotion, reducedMotion, forcePhase])

  const dragSessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    moved: boolean
    iconRect: DOMRect | null
    cardCenterX: number
    cardCenterY: number
  } | null>(null)

  // Measure the stage container + half-screen breakpoint
  useEffect(() => {
    const el = stageMeasureRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setTileSize({ w: rect.width, h: rect.height })
      }
      const rootEl = el.closest('.login-variant-root')
      const rootW = rootEl ? rootEl.getBoundingClientRect().width : window.innerWidth
      setIsHalfScreen(rootW <= 959)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const rootEl = el.closest('.login-variant-root')
    if (rootEl) ro.observe(rootEl)
    return () => ro.disconnect()
  }, [])

  const cameraPlan = useMemo(() => {
    if (tileSize.w <= 0 || tileSize.h <= 0) return null
    return computeAssembleCamera(tileSize.w, tileSize.h)
  }, [tileSize.w, tileSize.h])

  // Boot AlivingRenderer once (preloaded hidden from mount so handoff is seamless)
  useEffect(() => {
    const host = engineHostRef.current
    if (resolvedSource.kind !== 'aliving' || !host) {
      engineStatusRef.current = 'error'
      return
    }
    const renderer = new AlivingRenderer({
      modelUrl: resolvedSource.modelUrl,
      engineUrl: resolvedSource.engineUrl,
      playerUrl: resolvedSource.playerUrl,
      reactionsUrl: resolvedSource.reactionsUrl,
    })
    rendererRef.current = renderer
    renderer.attach(host)
    const unsub = renderer.subscribe(() => {
      const next = toReadiness(renderer.getStatus(), true)
      engineStatusRef.current = next
      setEngineStatus(next)
      setMachine((prev) =>
        transitionAssembleState(prev, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: next }),
      )
    })
    return () => {
      unsub()
      renderer.destroy()
      rendererRef.current = null
    }
  }, [resolvedSource])

  // Keep AlivingRenderer setView synchronized with cameraPlan
  useEffect(() => {
    const renderer = rendererRef.current
    if (renderer?.setView && cameraPlan) {
      renderer.setView(cameraPlan.view.zoom, cameraPlan.view.cx, cameraPlan.view.cy)
    }
  }, [cameraPlan])

  // Map login reactions to Aliving2D v2 expressions & fixed gaze overrides (emailFocus / passwordFocus)
  // During the 260ms live crossfade, keep neutral expression & centered gaze (0, 0) to avoid double-image ghosting.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || engineStatus !== 'ready') return
    if (machine.phase !== 'live') return

    if (!crossfadeDone) {
      renderer.setExpression(null)
      renderer.lookAt(0, 0)
      return
    }

    const expr = mapReactionToV2Expression(reactionState)
    renderer.setExpression(expr)

    if (reactionState === 'emailFocus') {
      renderer.lookAt(0.22, 0)
      return
    }
    if (reactionState === 'passwordFocus') {
      const gaze = resolveGazeForState('passwordFocus', 1, {
        eyeScale: DEFAULT_DESKTOP_CONTROLS.eyeGazeScale,
        headScale: DEFAULT_DESKTOP_CONTROLS.headGazeScale,
      })
      if (gaze.kind === 'fixed') renderer.lookAt(gaze.x, gaze.y)
      return
    }
    // Default gentle gaze toward the right form until cursor moves
    renderer.lookAt(isHalfScreen ? 0 : 0.22, 0)
  }, [reactionState, reactionNonce, engineStatus, machine.phase, isHalfScreen, crossfadeDone])

  // Follow mouse/pen cursor across the whole window ONLY after live crossfade completes
  const pointerTrackingActive =
    machine.phase === 'live' &&
    crossfadeDone &&
    resolvedSource.kind === 'aliving' &&
    engineStatus === 'ready' &&
    !reducedMotion &&
    !machine.reducedMotion &&
    reactionState !== 'emailFocus' &&
    reactionState !== 'passwordFocus'

  useEffect(() => {
    if (!pointerTrackingActive || !cameraPlan) return

    let rafId: number | null = null
    let pendingPointer: { x: number; y: number } | null = null
    let listening = false

    const cancelFrame = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      pendingPointer = null
    }

    const flushGaze = () => {
      rafId = null
      const pt = pendingPointer
      pendingPointer = null
      const renderer = rendererRef.current
      const stageEl = stageMeasureRef.current
      if (!pt || !renderer || !stageEl || document.hidden) return
      const rect = stageEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const face = computeFaceScreenPosition(rect, cameraPlan, cameraPlan.shotB)
      const gaze = computePointerGaze({
        pointerX: pt.x,
        pointerY: pt.y,
        faceX: face.x,
        faceY: face.y,
        stageWidth: rect.width,
        stageHeight: rect.height,
      })
      renderer.lookAt(gaze.x, gaze.y)
    }

    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      pendingPointer = { x: e.clientX, y: e.clientY }
      if (rafId === null) {
        rafId = requestAnimationFrame(flushGaze)
      }
    }

    const onPointerLeaveOrBlur = () => {
      cancelFrame()
    }

    const attachListeners = () => {
      if (listening || document.hidden) return
      listening = true
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeaveOrBlur)
      window.addEventListener('blur', onPointerLeaveOrBlur)
    }

    const detachListeners = () => {
      if (!listening) return
      listening = false
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeaveOrBlur)
      window.removeEventListener('blur', onPointerLeaveOrBlur)
      cancelFrame()
    }

    const onVisibility = () => {
      if (document.hidden) detachListeners()
      else attachListeners()
    }

    attachListeners()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      detachListeners()
    }
  }, [pointerTrackingActive, cameraPlan])

  // Advance timed phases automatically (unless frozen by explicit exploding/meshing/assembling capture param)
  const isFrozenPreview =
    forcePhase === 'exploding' || forcePhase === 'meshing' || forcePhase === 'assembling'

  // Premount inline poly.svg elements during idle via requestIdleCallback (fallback setTimeout 300ms)
  // so SVG parsing, pathLength geometry, and WebP layer decoding finish before the animation starts;
  // unmount again on live/static.
  useEffect(() => {
    if (machine.phase === 'live' || machine.phase === 'static') {
      const resetTimer = window.setTimeout(() => setPolyPremounted(false), 0)
      return () => window.clearTimeout(resetTimer)
    }
    if (machine.phase !== 'idle' || reducedMotion || machine.reducedMotion) return
    const warmUp = () => {
      setPolyPremounted(true)
      const root = stageMeasureRef.current
      if (root) {
        root.querySelectorAll<HTMLImageElement>('img.assemble-layer-img').forEach((img) => {
          void img.decode?.().catch(() => {})
        })
      }
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const idleId = w.requestIdleCallback(warmUp, { timeout: 600 })
      return () => w.cancelIdleCallback?.(idleId)
    }
    const timer = window.setTimeout(warmUp, 300)
    return () => window.clearTimeout(timer)
  }, [machine.phase, machine.reducedMotion, reducedMotion])

  // Once poly.svg elements are premounted during idle, warm up SVG pathLength caches off the animation path
  useEffect(() => {
    if (!polyPremounted || machine.phase !== 'idle') return
    const root = stageMeasureRef.current
    if (!root) return
    const paths = Array.from(root.querySelectorAll<SVGPathElement>('.assemble-poly-svg .mesh-edges'))
    if (paths.length === 0) return
    let idx = 0
    let handle = 0
    const step = () => {
      if (idx >= paths.length) return
      try {
        paths[idx]?.getTotalLength()
      } catch {
        // Ignore detached nodes
      }
      idx += 1
      if (idx < paths.length) {
        handle = window.setTimeout(step, 8)
      }
    }
    handle = window.setTimeout(step, 16)
    return () => window.clearTimeout(handle)
  }, [polyPremounted, machine.phase])

  // Sample FPS during exploding; if < 50 FPS, omit vertex dots on heavy layers (back-hair & body)
  useEffect(() => {
    if (machine.phase !== 'exploding' || isFrozenPreview) return
    let frames = 0
    const start = performance.now()
    let rafId = 0
    const tick = (now: number) => {
      frames++
      const elapsed = now - start
      if (elapsed >= 400) {
        const fps = (frames * 1000) / elapsed
        setOmitHeavyVerts(fps < 50)
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [machine.phase, isFrozenPreview])
  useEffect(() => {
    if (isFrozenPreview) return
    const duration = getAssembleStepDurationMs(machine)
    if (duration === null) return
    const timer = window.setTimeout(() => {
      setMachine((prev) =>
        transitionAssembleState(prev, {
          type: 'STEP_COMPLETE',
          live2dStatus: engineStatusRef.current,
        }),
      )
    }, duration)
    return () => window.clearTimeout(timer)
  }, [machine, isFrozenPreview])

  // Side effects on terminal phases (live / static): persist seen, A -> B camera move, delayed greet bubble
  useEffect(() => {
    if (machine.phase !== 'live' && machine.phase !== 'static') {
      if (machine.phase === 'idle') completedEmittedRef.current = false
      return
    }

    if (!completedEmittedRef.current) {
      completedEmittedRef.current = true
      if (!forcePhase) writeAssembleSeen(localStore(), true)
      emitLoginDesktopEvent({
        name: 'login_assemble_completed',
        payload: { result: machine.phase },
      })
      if (machine.phase === 'live') {
        // Hold neutral expression + center gaze during the 260ms crossfade; happy triggers right after.
        rendererRef.current?.setExpression(null)
        rendererRef.current?.lookAt(0, 0)
        onLiveEnteredRef.current?.()
      }
    }

    const immediateB =
      skipCameraMoveRef.current || isHalfScreen || reducedMotion || machine.reducedMotion
    if (immediateB) {
      const immediateTimer = window.setTimeout(() => {
        setCrossfadeDone(true)
        setCameraInB(true)
        if (machine.phase === 'live') {
          rendererRef.current?.setExpression('happy')
          onGreetBubbleReadyRef.current?.()
        }
      }, 0)
      return () => window.clearTimeout(immediateTimer)
    }

    // After 260ms crossfade: apply happy expression, enable cursor tracking, and start 1200ms A -> B zoom
    const moveTimer = window.setTimeout(() => {
      setCrossfadeDone(true)
      setCameraInB(true)
      if (machine.phase === 'live') {
        rendererRef.current?.setExpression('happy')
      }
    }, ASSEMBLE_TIMINGS_MS.liveFade)

    const bubbleTimer =
      machine.phase === 'live'
        ? window.setTimeout(() => {
            onGreetBubbleReadyRef.current?.()
          }, ASSEMBLE_TIMINGS_MS.liveFade + ASSEMBLE_TIMINGS_MS.cameraMove)
        : undefined

    return () => {
      window.clearTimeout(moveTimer)
      if (bubbleTimer !== undefined) window.clearTimeout(bubbleTimer)
    }
  }, [machine.phase, machine.reducedMotion, isHalfScreen, reducedMotion, forcePhase])

  // 6-second idle demo ghost cursor (once, skipped under reduced-motion or forced preview)
  useEffect(() => {
    if (machine.phase !== 'idle' || reducedMotion || demoPlayedRef.current || forcePhase) {
      return
    }
    const startTimer = window.setTimeout(() => {
      demoPlayedRef.current = true
      setShowDemoCursor(true)
    }, ASSEMBLE_TIMINGS_MS.demoIdleDelay)
    return () => window.clearTimeout(startTimer)
  }, [machine.phase, reducedMotion, forcePhase])

  useEffect(() => {
    if (!showDemoCursor) return
    const endTimer = window.setTimeout(() => setShowDemoCursor(false), 2400)
    return () => window.clearTimeout(endTimer)
  }, [showDemoCursor])

  const cancelDemo = useCallback(() => {
    if (showDemoCursor) setShowDemoCursor(false)
  }, [showDemoCursor])

  const computeCardToIconDelta = useCallback((): { x: number; y: number } => {
    const card = cardBtnRef.current?.getBoundingClientRect()
    const icon = iconBtnRef.current?.getBoundingClientRect()
    if (!card || !icon) return { x: 180, y: 0 }
    return {
      x: icon.left + icon.width / 2 - (card.left + card.width / 2),
      y: icon.top + icon.height / 2 - (card.top + card.height / 2),
    }
  }, [])

  const triggerWake = useCallback(
    (method: AssembleMethod) => {
      skipCameraMoveRef.current = false
      const jumpB = isHalfScreen || reducedMotion
      setCameraInB(jumpB)
      setCrossfadeDone(jumpB)
      setShowDemoCursor(false)
      setDropHover(false)
      setDragOffset(computeCardToIconDelta())
      emitLoginDesktopEvent({ name: 'login_assemble_started', payload: { method } })
      setMachine((prev) =>
        transitionAssembleState(prev, {
          type: 'TRIGGER',
          method,
          reducedMotion,
        }),
      )
    },
    [computeCardToIconDelta, isHalfScreen, reducedMotion],
  )

  const handleCardPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (machine.phase !== 'idle') return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    cancelDemo()
    const cardRect = e.currentTarget.getBoundingClientRect()
    const iconRect = iconBtnRef.current?.getBoundingClientRect() ?? null
    e.currentTarget.setPointerCapture(e.pointerId)
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      iconRect,
      cardCenterX: cardRect.left + cardRect.width / 2,
      cardCenterY: cardRect.top + cardRect.height / 2,
    }
  }

  const handleCardPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== e.pointerId) return
    const dx = e.clientX - session.startX
    const dy = e.clientY - session.startY
    if (!session.moved && Math.hypot(dx, dy) > 8) {
      session.moved = true
      setMachine((prev) => transitionAssembleState(prev, { type: 'DRAG_START' }))
    }
    if (!session.moved) return
    setDragOffset({ x: dx, y: dy })

    if (session.iconRect) {
      const pad = 32
      const cx = session.cardCenterX + dx
      const cy = session.cardCenterY + dy
      const r = session.iconRect
      const pointerInside =
        e.clientX >= r.left - pad &&
        e.clientX <= r.right + pad &&
        e.clientY >= r.top - pad &&
        e.clientY <= r.bottom + pad
      const cardCenterInside =
        cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad
      setDropHover(pointerInside || cardCenterInside)
    }
  }

  const finishCardPointer = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== e.pointerId) return
    dragSessionRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore if capture was already released
    }

    if (cancelled) {
      setDragOffset({ x: 0, y: 0 })
      setDropHover(false)
      setMachine((prev) => transitionAssembleState(prev, { type: 'DRAG_CANCEL' }))
      return
    }

    if (!session.moved) {
      triggerWake('click')
      return
    }

    if (dropHover) {
      triggerWake('drag')
    } else {
      setDragOffset({ x: 0, y: 0 })
      setDropHover(false)
      setMachine((prev) => transitionAssembleState(prev, { type: 'DRAG_CANCEL' }))
    }
  }

  const handleKeyActivate = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      triggerWake('keyboard')
    }
  }

  const handleReplay = () => {
    demoPlayedRef.current = true
    skipCameraMoveRef.current = false
    const jumpB = isHalfScreen || reducedMotion
    setCameraInB(jumpB)
    setCrossfadeDone(jumpB)
    setDragOffset({ x: 0, y: 0 })
    setDropHover(false)
    setShowDemoCursor(false)
    emitLoginDesktopEvent({ name: 'login_assemble_replayed', payload: {} })
    setMachine((prev) => transitionAssembleState(prev, { type: 'REPLAY' }))
  }

  const { phase } = machine
  const showDmgDock = phase === 'idle' || phase === 'dragging' || phase === 'dropped'
  const showLayers =
    !machine.reducedMotion &&
    (phase === 'dropped' || phase === 'exploding' || phase === 'meshing' || phase === 'assembling')
  const isExploded = phase === 'exploding' || phase === 'meshing'
  const isMeshing = phase === 'meshing'
  const isAssembling = phase === 'assembling' && !machine.waitingForLive2D
  // Premount poly SVGs during idle (visibility:hidden) to avoid meshing mount hitch; unmount on live/static.
  const isActiveSequence =
    phase === 'dropped' || phase === 'exploding' || phase === 'meshing' || phase === 'assembling'
  const mountPolySvgs =
    !machine.reducedMotion &&
    !reducedMotion &&
    (isActiveSequence || (polyPremounted && (phase === 'idle' || phase === 'dragging')))
  const showPolySvgs = isMeshing || isAssembling
  // Skeleton SVG mounts only while assembling (opacity 0 during tilted/exploded phases, unmounted on live/static).
  const mountRigSvg = !machine.reducedMotion && isAssembling
  const showStaticFull = phase === 'static' || (machine.reducedMotion && phase === 'dropped')
  const showEngineCanvas = phase === 'live' && engineStatus === 'ready'
  const showReplay = phase === 'live' || phase === 'static'

  // Precompute skeleton joint coordinates in .assemble-camera pixel space (Shot A front-facing, depth 0)
  const rigJointCoords = useMemo(() => {
    if (!cameraPlan || !mountRigSvg) return null
    const scale = CHAERIN_ASSEMBLE_MANIFEST.frame.scale
    const out = {} as Record<RigJointId, { x: number; y: number }>
    for (const [id, [x3, y3]] of Object.entries(CHAERIN_ASSEMBLE_MANIFEST.rig.joints) as Array<
      [RigJointId, readonly [number, number]]
    >) {
      const pt = modelPointToScreen(x3 / scale, y3 / scale, cameraPlan.cameraW, cameraPlan.cameraH, cameraPlan.view)
      out[id] = { x: pt.x, y: pt.y }
    }
    return out
  }, [cameraPlan, mountRigSvg])

  // Determine active camera shot transform (A / Explode / B)
  const activeCameraShot = useMemo(() => {
    if (!cameraPlan) return null
    if (isHalfScreen || reducedMotion || machine.reducedMotion) return cameraPlan.shotB
    if (isExploded) return cameraPlan.shotExplode
    if ((phase === 'live' || phase === 'static') && cameraInB) return cameraPlan.shotB
    return cameraPlan.shotA
  }, [cameraPlan, isHalfScreen, reducedMotion, machine.reducedMotion, isExploded, phase, cameraInB])

  const cameraPoseAttr = isHalfScreen || reducedMotion || machine.reducedMotion
    ? 'B'
    : isExploded
      ? 'explode'
      : (phase === 'live' || phase === 'static') && cameraInB
        ? 'B'
        : 'A'

  const cameraStyle: CSSProperties | undefined =
    cameraPlan && activeCameraShot
      ? ({
          left: `${cameraPlan.offsetLeft}px`,
          top: `${cameraPlan.offsetTop}px`,
          width: `${cameraPlan.cameraW}px`,
          height: `${cameraPlan.cameraH}px`,
          transform: `translate3d(${activeCameraShot.tx}px, ${activeCameraShot.ty}px, 0) scale(${activeCameraShot.scale})`,
        } as CSSProperties)
      : undefined

  const fullBox = useMemo(() => {
    if (!cameraPlan) return null
    return computeAlivingLayerBox(
      CHAERIN_ASSEMBLE_MANIFEST.full,
      cameraPlan.cameraW,
      cameraPlan.cameraH,
      cameraPlan.view,
      CHAERIN_ASSEMBLE_MANIFEST.frame.scale,
    )
  }, [cameraPlan])

  return (
    <div
      ref={stageMeasureRef}
      className="assemble-stage-root"
      data-assemble-phase={phase}
      data-assemble-camera={cameraPoseAttr}
      data-assemble-reduced={machine.reducedMotion || undefined}
      data-assemble-frozen={isFrozenPreview || undefined}
      data-mate-renderer={resolvedSource.kind}
      data-live2d-status={engineStatus}
      onPointerMove={cancelDemo}
      onKeyDown={cancelDemo}
    >
      {/* Masked camera stage: soft right-edge fade eliminates vertical cutoff */}
      <div className="assemble-stage-mask">
        <div
          className="assemble-camera"
          data-camera-pose={cameraPoseAttr}
          data-camera-transition={
            phase === 'live' || phase === 'static'
              ? 'zoom-b'
              : phase === 'assembling'
                ? 'assemble'
                : 'explode'
          }
          style={cameraStyle}
        >
          {/* Aliving2D WebGL2 canvas (rendered in cameraPlan.view so Shot B is native 1:1 and Shot A never clips) */}
          <div
            ref={engineHostRef}
            className="assemble-engine-host"
            aria-hidden="true"
            data-visible={showEngineCanvas || undefined}
          />

          {/* Pixel-aligned 9-layer 3D watch-exploded rig (depth-only separation, zero XY wobble) */}
          <div
            className="assemble-rig-viewport"
            aria-hidden="true"
            data-visible={showLayers || undefined}
            data-exploded={isExploded || undefined}
            data-meshing={isMeshing || undefined}
            data-assembling={isAssembling || undefined}
            data-phase={phase}
          >
            {cameraPlan && (
              <div className="assemble-rig-pivot">
                {CHAERIN_ASSEMBLE_MANIFEST.layers.map((layer) => {
                  const box = computeAlivingLayerBox(
                    layer,
                    cameraPlan.cameraW,
                    cameraPlan.cameraH,
                    cameraPlan.view,
                    CHAERIN_ASSEMBLE_MANIFEST.frame.scale,
                  )
                  const timing = LAYER_ASSEMBLE_TIMING[layer.z] ?? {
                    delayMs: layer.z * 80,
                    durationMs: 320,
                    meshPeak: 0.5,
                  }
                  const ez = (layer.z - 4) * 85
                  const showVerts =
                    !(omitHeavyVerts && (layer.id === 'back-hair' || layer.id === 'body'))
                  const vertStrokeW = layer.poly.vertRadius * 2 * (isHalfScreen ? 0.7 : 1)
                  const slotStyle = {
                    zIndex: layer.z + 1,
                    '--z': layer.z,
                    '--ez': `${ez}px`,
                    '--assemble-delay': `${timing.delayMs}ms`,
                    '--assemble-dur': `${timing.durationMs}ms`,
                    '--mesh-draw-delay': `${layer.z * 25}ms`,
                    '--mesh-snap-delay': `${timing.delayMs + Math.max(0, timing.durationMs - 100)}ms`,
                    '--mesh-peak': timing.meshPeak,
                  } as CSSProperties

                  return (
                    <div key={layer.id} className="assemble-layer-slot" style={slotStyle}>
                      <div className="assemble-layer-rot">
                        <div className="assemble-layer-z">
                          <div
                            className="assemble-layer"
                            style={{
                              left: `${box.left}px`,
                              top: `${box.top}px`,
                              width: `${box.width}px`,
                              height: `${box.height}px`,
                            }}
                          >
                            <img
                              src={layer.url}
                              alt=""
                              className="assemble-layer-img"
                              draggable={false}
                              decoding="async"
                            />
                            {mountPolySvgs && (
                              <svg
                                className="assemble-poly-svg"
                                data-active={showPolySvgs || undefined}
                                viewBox={layer.poly.viewBox}
                                preserveAspectRatio="none"
                                aria-hidden="true"
                              >
                                <path
                                  className="mesh-edges"
                                  d={layer.poly.edgesD}
                                  pathLength={1}
                                  fill="none"
                                  stroke="#d6c8ff"
                                  strokeWidth={1.6}
                                  strokeLinecap="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                                {showVerts && (
                                  <g
                                    className="mesh-verts"
                                    fill="none"
                                    stroke="#ffffff"
                                    strokeWidth={vertStrokeW}
                                    strokeLinecap="round"
                                  >
                                    {layer.poly.vertBands.map(
                                      (d, bandIdx) =>
                                        d && (
                                          <path
                                            key={bandIdx}
                                            className="mesh-vert-band"
                                            d={d}
                                            style={{ '--band': bandIdx } as CSSProperties}
                                          />
                                        ),
                                    )}
                                  </g>
                                )}
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Skeleton rigging overlay (outside 3D rig, fixed in Shot A front plane depth 0; draws during assembling +150ms) */}
          {mountRigSvg && cameraPlan && rigJointCoords && (
            <svg
              className="assemble-skeleton-svg"
              viewBox={`0 0 ${cameraPlan.cameraW} ${cameraPlan.cameraH}`}
              aria-hidden="true"
              data-phase={phase}
            >
              <g className="assemble-rig-bones">
                {RIG_BONE_SCHEDULE.map((bone) => {
                  const a = rigJointCoords[bone.from]
                  const b = rigJointCoords[bone.to]
                  return (
                    <line
                      key={`${bone.from}-${bone.to}`}
                      className="assemble-rig-bone"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      pathLength={1}
                      style={
                        {
                          '--bone-delay': `${bone.delayMs}ms`,
                          '--bone-dur': `${bone.durationMs}ms`,
                        } as CSSProperties
                      }
                    />
                  )
                })}
              </g>
              <g className="assemble-rig-joints">
                {VISIBLE_RIG_JOINTS.map((joint) => {
                  const pt = rigJointCoords[joint.id]
                  return (
                    <circle
                      key={joint.id}
                      className="assemble-rig-joint"
                      data-sparkle={joint.sparkle || undefined}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHalfScreen ? 2.8 : 4}
                      style={
                        {
                          '--joint-delay': `${joint.delayMs}ms`,
                          transformOrigin: `${pt.x}px ${pt.y}px`,
                        } as CSSProperties
                      }
                    />
                  )
                })}
              </g>
            </svg>
          )}

          {/* Static full.webp fallback (or reduced-motion crossfade bridge) inside same camera wrapper */}
          {fullBox && (
            <div
              className="assemble-static-layer"
              aria-hidden="true"
              data-visible={showStaticFull || undefined}
              data-breathing={(phase === 'static' && !reducedMotion) || undefined}
            >
              <img
                src={CHAERIN_ASSEMBLE_MANIFEST.full.url}
                alt=""
                className="assemble-static-img"
                draggable={false}
                style={{
                  left: `${fullBox.left}px`,
                  top: `${fullBox.top}px`,
                  width: `${fullBox.width}px`,
                  height: `${fullBox.height}px`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* macOS glass window drag-and-drop dock */}
      {showDmgDock && (
        <div
          className="assemble-dmg-overlay"
          data-phase={phase}
          data-dragging={phase === 'dragging' || undefined}
        >
          <div className="assemble-dmg-win">
            <div className="assemble-win-bar">
              <div className="assemble-win-dots" aria-hidden="true">
                <span className="assemble-win-dot assemble-win-dot--close" />
                <span className="assemble-win-dot assemble-win-dot--min" />
                <span className="assemble-win-dot assemble-win-dot--max" />
              </div>
              <span className="assemble-win-title">채린 깨우기</span>
            </div>

            <div className="assemble-dmg-body">
              <button
                ref={cardBtnRef}
                type="button"
                className="assemble-card-btn"
                aria-label="채린이 깨우기"
                data-dragging={phase === 'dragging' || undefined}
                data-dropped={phase === 'dropped' || undefined}
                style={
                  {
                    '--drag-x': `${dragOffset.x}px`,
                    '--drag-y': `${dragOffset.y}px`,
                  } as CSSProperties
                }
                onPointerDown={handleCardPointerDown}
                onPointerMove={handleCardPointerMove}
                onPointerUp={(e) => finishCardPointer(e, false)}
                onPointerCancel={(e) => finishCardPointer(e, true)}
                onKeyDown={handleKeyActivate}
              >
                <span className="assemble-photo-frame" aria-hidden="true">
                  <img
                    src={CHAERIN_ASSEMBLE_MANIFEST.full.url}
                    alt=""
                    className="assemble-photo-img"
                    draggable={false}
                  />
                </span>
                <span className="assemble-item-name">채린</span>
                <span className="assemble-item-sub">chaerin.png</span>
              </button>

              <div className="assemble-drop-flow" aria-hidden="true" data-active={dropHover || undefined}>
                <i />
                <i />
                <i />
              </div>

              <button
                ref={iconBtnRef}
                type="button"
                className="assemble-icon-btn"
                aria-label="채린이 깨우기"
                data-drop-hover={dropHover || undefined}
                data-dropped={phase === 'dropped' || undefined}
                onClick={() => triggerWake('click')}
                onKeyDown={handleKeyActivate}
              >
                <span className="assemble-icon-dropzone" aria-hidden="true">
                  <img
                    src={ASSEMBLE_APP_ICON_URL}
                    alt=""
                    className="assemble-app-icon-img"
                    draggable={false}
                  />
                </span>
                <span className="assemble-item-name">CAPSULE</span>
                <span className="assemble-item-sub">여기에 놓기</span>
              </button>

              {/* 6-second idle demo ghost cursor */}
              {showDemoCursor && (
                <span className="assemble-demo-cursor" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5.5 3.2L18.4 12.1L12.6 13.3L15.4 19.2L13 20.4L10.2 14.5L6.2 18.2L5.5 3.2Z"
                      fill="rgba(255,255,255,0.92)"
                      stroke="rgba(18,10,38,0.75)"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </div>

            <div className="assemble-dmg-foot">
              <span className="assemble-dmg-foot-main">
                카드를 <b>CAPSULE</b>로 끌어다 놓으면 채린이가 깨어나요
              </span>
              <span className="assemble-dmg-kbd">또는 클릭</span>
            </div>
          </div>
        </div>
      )}

      {/* Subtle replay button in live/static state (offset right of dev panel button) */}
      {showReplay && (
        <button type="button" className="assemble-replay-btn" onClick={handleReplay}>
          다시 보기
        </button>
      )}

      {/* Screen-reader live announcement */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {phase === 'live' ? '채린이가 나타났어요' : ''}
      </span>
    </div>
  )
}
