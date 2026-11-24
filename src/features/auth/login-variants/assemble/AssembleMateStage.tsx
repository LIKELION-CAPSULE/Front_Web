import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
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
  CHAERIN_V2_LANDMARKS,
  computeAlivingLayerBox,
  computeBustCamera,
  computeFaceScreenPosition,
  computePointerGaze,
  modelPointToScreen,
} from '@/features/mate-render/aliving-view'
import { resolveMateSource } from '@/features/mate-render/mate-source'
import type { MateRenderStatus, MateRenderer } from '@/features/mate-render/types'
import {
  ASSEMBLE_APP_ICON_URL,
  CHAERIN_ASSEMBLE_MANIFEST,
} from './assemble-assets'
import {
  ASSEMBLE_TIMINGS_MS,
  assembleGreetDelayMs,
  createInitialAssembleState,
  getAssembleStepDurationMs,
  readAssembleSeen,
  resolveClickActivation,
  transitionAssembleState,
  writeAssembleSeen,
  type AssembleForcePhase,
  type AssembleMachineState,
  type AssembleMethod,
  type AssemblePhase,
  type Live2DReadiness,
} from './assemble-machine'
import './assemble.css'
import './assemble-transform.css'

/** Tiny deterministic PRNG so the B-style particle fields are identical on every render / capture. */
function seeded(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return (((r ^ (r >>> 14)) >>> 0) / 4294967296)
  }
}

/** Fine motes that travel along the light stream from the CAPSULE icon to the model (offsets in px along/around the stream). */
const TRANSFORM_STREAM_MOTES: ReadonlyArray<{ x0: number; y0: number; delayMs: number; durMs: number; size: number }> =
  (() => {
    const rnd = seeded(7)
    return Array.from({ length: 34 }, (_, i) => ({
      x0: Math.round(rnd() * 70),
      y0: Math.round((rnd() - 0.5) * 56),
      delayMs: 215 + Math.round(i * 7 + rnd() * 40),
      durMs: 380 + Math.round(rnd() * 140),
      size: Math.round((1.8 + rnd() * 2) * 10) / 10,
    }))
  })()

/** Fill-sweep timing of the shared boundary (must match assemble-transform.css `tf-fill-sweep`). */
const TRANSFORM_FILL_MS = 900
const TRANSFORM_FILL_P0 = 0.15
const TRANSFORM_FILL_P1 = 0.95

/**
 * Small, numerous motes released as the common fill boundary passes them (bottom -> top).
 * `delayMs` is when the linear sweep boundary reaches the mote's y; x/y are % of the full-image box.
 */
const TRANSFORM_FILL_MOTES: ReadonlyArray<{ x: number; y: number; delayMs: number; size: number; rise: number }> =
  (() => {
    const rnd = seeded(23)
    return Array.from({ length: 44 }, () => {
      const y = 0.04 + rnd() * 0.9
      const boundaryP = (1.475 - y) / 2
      const t = (boundaryP - TRANSFORM_FILL_P0) / (TRANSFORM_FILL_P1 - TRANSFORM_FILL_P0)
      return {
        x: 14 + rnd() * 72,
        y: y * 100,
        delayMs: Math.max(0, Math.round(t * TRANSFORM_FILL_MS)),
        size: Math.round((1.4 + rnd() * 1.8) * 10) / 10,
        rise: 16 + Math.round(rnd() * 22),
      }
    })
  })()

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
  // Crossfade gate: starts done (crossfadeDone=true) on revisit, half-screen, reduced-motion, or forced live/static;
  // otherwise the Live2D crossfade holds a neutral face & center gaze (0,0), then after 260ms triggers happy + cursor tracking.
  const immediateInit =
    forcePhase === 'live' ||
    forcePhase === 'static' ||
    (forcePhase === null && (initialSeen || reducedMotion)) ||
    (typeof window !== 'undefined' && window.innerWidth <= 959)
  const [crossfadeDone, setCrossfadeDone] = useState<boolean>(immediateInit)

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dropHover, setDropHover] = useState(false)
  const [showDemoCursor, setShowDemoCursor] = useState(false)
  /** Gentle "drag me" hint after a plain click/tap: alternates 'a'/'b' so the CSS animation restarts each time. */
  const [nudge, setNudge] = useState<'a' | 'b' | null>(null)

  /** Where the capsule light burst originates (CAPSULE icon center, stage-relative px) for the `transform` style. */
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | null>(null)

  const wakeStartedRef = useRef(false)
  const forcePhaseRef = useRef(forcePhase)
  const demoPlayedRef = useRef(false)
  const completedEmittedRef = useRef(false)
  /** The greeting has been shown for this wake-up (cleared on `idle`, i.e. replay). */
  const greetedRef = useRef(false)
  const skipIntroRef = useRef(
    forcePhase === 'live' || forcePhase === 'static' || (forcePhase === null && initialSeen),
  )
  const onLiveEnteredRef = useRef(onLiveEntered)
  const onGreetBubbleReadyRef = useRef(onGreetBubbleReady)
  const onPhaseChangeRef = useRef(onPhaseChange)
  useEffect(() => {
    forcePhaseRef.current = forcePhase
  }, [forcePhase])
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
      skipIntroRef.current || reducedMotion || machine.reducedMotion || forcePhase === 'live' || forcePhase === 'static'
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
    // One close bust framing for the whole sequence and for the Live2D live state (no camera moves).
    return computeBustCamera(tileSize.w, tileSize.h)
  }, [tileSize.w, tileSize.h])

  // Boot AlivingRenderer once (preloaded hidden from mount so handoff is seamless)
  useEffect(() => {
    const host = engineHostRef.current
    if (resolvedSource.kind !== 'aliving' || !host) {
      // No engine (static source, e.g. reduced motion switched on): keep the ref, the state and the machine in sync so
      // a `live` sequence falls back to the still image instead of showing nothing.
      engineStatusRef.current = 'error'
      setEngineStatus('error')
      if (!forcePhaseRef.current) {
        setMachine((prev) => transitionAssembleState(prev, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' }))
      }
      return
    }
    // A (new) renderer starts out loading; resync from any earlier source.
    engineStatusRef.current = 'loading'
    setEngineStatus('loading')
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
      // Forced capture previews (?assemble=...) keep their phase whatever the engine does.
      if (forcePhaseRef.current) return
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
      const face = computeFaceScreenPosition(rect, cameraPlan)
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

  // Advance timed phases automatically (unless frozen by explicit streaming/filling/settling capture param)
  const isFrozenPreview =
    forcePhase === 'streaming' || forcePhase === 'filling' || forcePhase === 'settling'

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
      if (machine.phase === 'idle') {
        completedEmittedRef.current = false
        greetedRef.current = false
      }
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
      skipIntroRef.current || isHalfScreen || reducedMotion || machine.reducedMotion
    // Greeting: live AND static (reduced motion / engine fallback) greet, once per wake-up. It is marked as shown only
    // when it fires, so a re-run that cancels a pending timer (live <-> static switch, resize) reschedules it.
    const greetDelay = assembleGreetDelayMs({
      phase: machine.phase,
      alreadyGreeted: greetedRef.current,
      immediate: immediateB,
    })
    const greet = () => {
      greetedRef.current = true
      onGreetBubbleReadyRef.current?.()
    }
    if (immediateB) {
      const immediateTimer = window.setTimeout(() => {
        setCrossfadeDone(true)
        if (machine.phase === 'live') rendererRef.current?.setExpression('happy')
        if (greetDelay !== null) greet()
      }, 0)
      return () => window.clearTimeout(immediateTimer)
    }

    // After the 260ms crossfade: apply the happy expression and enable cursor tracking (the framing never changes)
    const moveTimer = window.setTimeout(() => {
      setCrossfadeDone(true)
      if (machine.phase === 'live') {
        rendererRef.current?.setExpression('happy')
      }
    }, ASSEMBLE_TIMINGS_MS.liveFade)

    const bubbleTimer = greetDelay !== null ? window.setTimeout(greet, greetDelay) : undefined

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

  // Auto-clear the click hint (the shake animation is ~480ms; a repeat click within the window restarts it).
  useEffect(() => {
    if (!nudge) return
    const t = window.setTimeout(() => setNudge(null), 1400)
    return () => window.clearTimeout(t)
  }, [nudge])

  /** A click/tap without dragging does NOT wake Chaerin — show a light hint that it must be dragged. */
  const showDragHint = useCallback(() => {
    setNudge((prev) => (prev === 'a' ? 'b' : 'a'))
  }, [])

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
      // One start per sequence (Enter keydown + click, double activation, ...): analytics must fire once.
      if (wakeStartedRef.current) return
      wakeStartedRef.current = true
      skipIntroRef.current = false
      const jumpB = isHalfScreen || reducedMotion
      setCrossfadeDone(jumpB)
      setShowDemoCursor(false)
      setDropHover(false)
      setDragOffset(computeCardToIconDelta())
      const stageRect = stageMeasureRef.current?.getBoundingClientRect()
      const iconRect = iconBtnRef.current?.getBoundingClientRect()
      if (stageRect && iconRect) {
        setBurstOrigin({
          x: iconRect.left + iconRect.width / 2 - stageRect.left,
          y: iconRect.top + iconRect.height / 2 - stageRect.top,
        })
      }
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
      // Plain click/tap: wake-up requires drag-and-drop (keyboard Enter/Space stays as the a11y alternative).
      showDragHint()
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

  // Native click only: Enter / Space on a focused button (and assistive-technology activation) arrive as `detail === 0`
  // and start the sequence once; real pointer clicks (`detail > 0`) just hint, because pointers must drag-and-drop.
  // (A click also follows every pointerup on the card; the pointer handlers already cover that case.)
  const handleActivate = (e: MouseEvent<HTMLButtonElement>) => {
    if (resolveClickActivation(e.detail) === 'keyboard') {
      triggerWake('keyboard')
    } else if (e.currentTarget === iconBtnRef.current) {
      showDragHint()
    }
  }

  const handleReplay = () => {
    wakeStartedRef.current = false
    demoPlayedRef.current = true
    skipIntroRef.current = false
    const jumpB = isHalfScreen || reducedMotion
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
    (phase === 'dropped' || phase === 'streaming' || phase === 'filling' || phase === 'settling')
  const showBurst = !machine.reducedMotion && (phase === 'dropped' || phase === 'streaming')
  const showStaticFull = phase === 'static' || (machine.reducedMotion && phase === 'dropped')
  const showEngineCanvas = phase === 'live' && engineStatus === 'ready'
  const showReplay = phase === 'live' || phase === 'static'

  const cameraStyle: CSSProperties | undefined = cameraPlan
    ? ({
        left: `${cameraPlan.offsetLeft}px`,
        top: `${cameraPlan.offsetTop}px`,
        width: `${cameraPlan.cameraW}px`,
        height: `${cameraPlan.cameraH}px`,
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

  // The fill / light effects only need to cover what the bust shot actually shows (down to the stage
  // bottom), so the shared fill boundary sweeps the visible body for the whole fill step instead of the hidden legs.
  const tfVisibleHeight = fullBox && cameraPlan
    ? Math.max(1, Math.min(fullBox.height, cameraPlan.cameraH + 24 - fullBox.top))
    : 0
  const tfBoxStyle: CSSProperties | undefined = fullBox
    ? { left: `${fullBox.left}px`, top: `${fullBox.top}px`, width: `${fullBox.width}px`, height: `${tfVisibleHeight}px` }
    : undefined
  // Alpha of full.webp used as a CSS mask so light effects only ever paint on the character's own shape.
  const tfMaskStyle = useMemo<CSSProperties>(() => {
    const size = `${fullBox?.width ?? 0}px ${fullBox?.height ?? 0}px`
    return {
      WebkitMaskImage: `url(${CHAERIN_ASSEMBLE_MANIFEST.full.url})`,
      maskImage: `url(${CHAERIN_ASSEMBLE_MANIFEST.full.url})`,
      WebkitMaskSize: size,
      maskSize: size,
      WebkitMaskPosition: '0 0',
      maskPosition: '0 0',
    }
  }, [fullBox?.width, fullBox?.height])

  // Where the model's torso sits on the stage, so the light stream can fly there from the CAPSULE icon.
  const transformAnchor = useMemo(() => {
    if (!cameraPlan || !fullBox || tileSize.w <= 0 || tileSize.h <= 0) return null
    // Light lands mid-torso: inside the bust shot and clear of the face.
    const pt = modelPointToScreen(
      CHAERIN_V2_LANDMARKS.centerX,
      CHAERIN_V2_LANDMARKS.torsoY,
      cameraPlan.cameraW,
      cameraPlan.cameraH,
      cameraPlan.view,
    )
    return {
      stageX: tileSize.w / 2 + (pt.x - cameraPlan.cameraW / 2),
      stageY: tileSize.h / 2 + (pt.y - cameraPlan.cameraH / 2),
      boxXPct: ((pt.x - fullBox.left) / fullBox.width) * 100,
      boxYPct: ((pt.y - fullBox.top) / tfVisibleHeight) * 100,
    }
  }, [cameraPlan, fullBox, tfVisibleHeight, tileSize.w, tileSize.h])

  return (
    <div
      ref={stageMeasureRef}
      className="assemble-stage-root"
      data-assemble-phase={phase}
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
          style={cameraStyle}
        >
          {/* Aliving2D WebGL2 canvas (rendered in cameraPlan.view: same bust framing as the layers, native 1:1) */}
          <div
            ref={engineHostRef}
            className="assemble-engine-host"
            aria-hidden="true"
            data-visible={showEngineCanvas || undefined}
          />

          {/* "transform" style (B): light arrives at the model, a white silhouette blooms, then ONE shared fill boundary
              sweeps the whole body (bottom -> top) turning it into the real picture. No mesh / rig / 3D split. */}
          {cameraPlan && fullBox && (
            <div
              className="tf-viewport"
              aria-hidden="true"
              data-visible={showLayers || undefined}
              data-phase={phase}
            >
              <div
                className="tf-halo-back"
                style={{
                  left: `${fullBox.left + fullBox.width * 0.5}px`,
                  top: `${fullBox.top + tfVisibleHeight * 0.4}px`,
                  width: `${fullBox.width * 1.5}px`,
                  height: `${tfVisibleHeight * 1.15}px`,
                }}
              />
              <div className="tf-box" style={tfBoxStyle}>
                <div
                  className="tf-silhouette"
                  style={{ transformOrigin: `${transformAnchor?.boxXPct ?? 50}% ${transformAnchor?.boxYPct ?? 40}%` }}
                >
                  <i className="tf-silhouette-fill" style={tfMaskStyle} />
                </div>
                <div className="tf-fill">
                  {CHAERIN_ASSEMBLE_MANIFEST.layers.map((layer) => {
                    const box = computeAlivingLayerBox(
                      layer,
                      cameraPlan.cameraW,
                      cameraPlan.cameraH,
                      cameraPlan.view,
                      CHAERIN_ASSEMBLE_MANIFEST.frame.scale,
                    )
                    return (
                      <img
                        key={layer.id}
                        src={layer.url}
                        alt=""
                        className="tf-fill-layer"
                        draggable={false}
                        decoding="async"
                        style={{
                          left: `${box.left - fullBox.left}px`,
                          top: `${box.top - fullBox.top}px`,
                          width: `${box.width}px`,
                          height: `${box.height}px`,
                        }}
                      />
                    )
                  })}
                </div>
                <div className="tf-fx" style={tfMaskStyle}>
                  <i className="tf-glowband" />
                  <i className="tf-edge-move">
                    <b className="tf-edge-line" />
                  </i>
                  <i className="tf-gloss" />
                </div>
                <div className="tf-motes">
                  {TRANSFORM_FILL_MOTES.map((m, i) => (
                    <i
                      key={i}
                      className="tf-mote"
                      style={
                        {
                          left: `${m.x}%`,
                          top: `${m.y}%`,
                          width: `${m.size}px`,
                          height: `${m.size}px`,
                          '--d': `${m.delayMs}ms`,
                          '--rise': `${m.rise}px`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
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

      {/* "transform" style: capsule charge -> light stream icon => model -> bloom where the model appears (stage level) */}
      {showBurst && (() => {
        const ox = burstOrigin?.x ?? tileSize.w * 0.62
        const oy = burstOrigin?.y ?? tileSize.h * 0.46
        const ax = transformAnchor?.stageX ?? tileSize.w * 0.5
        const ay = transformAnchor?.stageY ?? tileSize.h * 0.45
        const len = Math.max(40, Math.hypot(ax - ox, ay - oy))
        const ang = (Math.atan2(ay - oy, ax - ox) * 180) / Math.PI
        return (
          <div
            className="tf-burst"
            aria-hidden="true"
            style={
              {
                '--ox': `${ox}px`,
                '--oy': `${oy}px`,
                '--ax': `${ax}px`,
                '--ay': `${ay}px`,
                '--len': `${len}px`,
                '--ang': `${ang}deg`,
              } as CSSProperties
            }
          >
            <i className="tf-charge-ring" />
            <i className="tf-charge-core" />
            <div className="tf-stream">
              <i className="tf-stream-glow" />
              <i className="tf-stream-beam" />
              <i className="tf-stream-head" />
              {TRANSFORM_STREAM_MOTES.map((m, i) => (
                <i
                  key={i}
                  className="tf-stream-mote"
                  style={
                    {
                      '--x0': `${m.x0}px`,
                      '--y0': `${m.y0}px`,
                      '--d': `${m.delayMs}ms`,
                      '--dur': `${m.durMs}ms`,
                      width: `${m.size}px`,
                      height: `${m.size}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <i className="tf-arrive-bloom" />
            <i className="tf-arrive-ring" />
          </div>
        )
      })()}

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
                aria-label="채린이 깨우기: 채린 카드를 CAPSULE 아이콘으로 끌어다 놓거나, 이 버튼에서 Enter 키를 누르세요"
                data-nudge={nudge ?? undefined}
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
                onClick={handleActivate}
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
                aria-label="CAPSULE 아이콘: 채린 카드를 여기에 끌어다 놓거나, Enter 키를 눌러 채린이 깨우기"
                data-drop-hover={dropHover || undefined}
                data-dropped={phase === 'dropped' || undefined}
                onClick={handleActivate}
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
