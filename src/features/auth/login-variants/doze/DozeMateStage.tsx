import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import { useLocation } from 'react-router'
import {
  DEFAULT_DESKTOP_CONTROLS,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { emitLoginDesktopEvent } from '@/features/auth/login-backgrounds/desktop/login-analytics'
import type { LoginMateProfile } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import { resolveGazeForState } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { AlivingRenderer } from '@/features/mate-render/AlivingRenderer'
import { computePointerGaze } from '@/features/mate-render/aliving-view'
import { resolveMateSource } from '@/features/mate-render/mate-source'
import { mateWarmPool } from '@/features/mate-render/warm-pool'
import { warmKey } from '@/features/mate-render/warm-renderer'
import type { MateRenderStatus } from '@/features/mate-render/types'
import dozeStillUrl from '@/assets/characters/chaerin-v2/chaerin-v2-doze.webp'
import yawnStillUrl from '@/assets/characters/chaerin-v2/expressions-bust/yawn.webp'
import happyStillUrl from '@/assets/characters/chaerin-v2/expressions-bust/happy.webp'
import shyStillUrl from '@/assets/characters/chaerin-v2/expressions-bust/shy.webp'
import {
  dozeCallLine,
  DOZE_KEY_LINE,
  DOZE_GREETING,
  DOZE_STILL_POSE,
  DOZE_TIMINGS_MS,
  WAKE_EXPRESSION_CUES,
  dozePose,
  fallAsleepPose,
  parseDozeDevQuery,
  wakeGreetDelay,
  wakePose,
  recoverFromLiveLoss,
  type DozePhase,
  type DozeStill,
  type TrackParams,
} from './doze-motion'
import { computeDozeCamera, computeDozeScene, isPointerNearFace } from './doze-view'
import { DozeDesk } from './DozeDesk'
import { listenAll, startFrameLoop } from './doze-runtime'
import { engineAllowlist } from '@/features/mate-render/engine-allowlist'
import './doze.css'

/**
 * "졸던 채린 깨우기" (the /login stage): Chaerin dozes behind a laptop; coming close to her, clicking / tapping her or
 * pressing a key wakes her up (blinks → yawn → looks at you → smile + greeting). The Live2D model is the star when it
 * can run; the same story is told with still crossfades without it: production until the login mate API exists,
 * reduced motion, no WebGL, while the model loads, and the DEV query `static=1`.
 */

const NO_DEV_QUERY = { forceStatic: false, forceAwake: false } as const

type Phase = DozePhase
type WakeMethod = 'tap' | 'keyboard' | 'near' | 'auto'
type StillName = DozeStill | 'shy'

const STILLS: Record<StillName, string> = {
  doze: dozeStillUrl,
  yawn: yawnStillUrl,
  happy: happyStillUrl,
  shy: shyStillUrl,
}

/** Login reaction → v2 expression once she is awake. */
function reactionExpression(state: MateReactionState): string | null {
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

export default function DozeMateStage({
  mate,
  allowLive2D,
  reducedMotion,
  reactionState,
  reactionNonce,
  onGreet,
  onAwakeChange,
  onMateFrame,
}: {
  mate: LoginMateProfile
  allowLive2D: boolean
  reducedMotion: boolean
  reactionState: MateReactionState
  reactionNonce: number
  /** Called once per wake-up, right after `onAwakeChange(true)`. */
  onGreet: (line: string) => void
  onAwakeChange: (awake: boolean, immediate: boolean) => void
  /** Where she is drawn horizontally in stage px (centre, width), so the layout can centre the dialogue box on her. */
  onMateFrame?: (frame: { cx: number; width: number } | null) => void
}) {
  const location = useLocation()
  // DEV-only switches (see parseDozeDevQuery); a constant in production builds.
  const devQuery = useMemo(
    () => (import.meta.env.DEV ? parseDozeDevQuery(location.search) : NO_DEV_QUERY),
    [location.search],
  )
  const forceStatic = devQuery.forceStatic
  const rootRef = useRef<HTMLDivElement>(null)
  const engineHostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<AlivingRenderer | null>(null)
  const hitRef = useRef<HTMLButtonElement>(null)

  const source = useMemo(() => {
    if (!allowLive2D || forceStatic || !mate.v2Model) return { kind: 'static' as const }
    return resolveMateSource(
      {
        modelUrl: mate.v2Model.modelJsonUrl,
        engineUrl: mate.v2Model.engineUrl,
        playerUrl: mate.v2Model.playerUrl,
        reactionsUrl: mate.v2Model.reactionsUrl,
        format: mate.v2Model.format,
      },
      engineAllowlist(),
    )
  }, [allowLive2D, forceStatic, mate.v2Model])

  const [size, setSize] = useState({ w: 0, h: 0, compact: false })
  const [engineStatus, setEngineStatus] = useState<MateRenderStatus>(source.kind === 'aliving' ? 'loading' : 'error')
  /** The live model is posed and faded in over the still. */
  const [liveShown, setLiveShown] = useState(false)
  const [phase, setPhaseState] = useState<Phase>('dozing')
  const [still, setStill] = useState<StillName>('doze')
  const [shy, setShy] = useState(false)
  const [hint, setHint] = useState<'none' | 'pointer' | 'keyboard'>('none')
  const [announce, setAnnounce] = useState('')
  /** The yawn / happy / shy stills are fetched only when the still path may need them (no live model yet). */
  const [allStills, setAllStills] = useState(false)

  const phaseRef = useRef<Phase>('dozing')
  const liveShownRef = useRef(false)
  /** Set below (handleLiveLost): the renderer subscription calls it when a shown live model stops being ready. */
  const liveLostRef = useRef<() => void>(() => {})
  /** Origin of the nod cycle (`dozePose(0)` = the doze still). */
  const nodStartRef = useRef(0)
  const wakeStartRef = useRef(0)
  const fallStartRef = useRef(0)
  const wakeFromRef = useRef<TrackParams>(DOZE_STILL_POSE)
  const lastPoseRef = useRef<TrackParams>(DOZE_STILL_POSE)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)
  const timersRef = useRef<number[]>([])
  const onGreetRef = useRef(onGreet)
  const onAwakeChangeRef = useRef(onAwakeChange)
  useEffect(() => {
    onGreetRef.current = onGreet
    onAwakeChangeRef.current = onAwakeChange
  }, [onGreet, onAwakeChange])
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }, [])
  const later = useCallback((ms: number, run: () => void) => {
    timersRef.current.push(window.setTimeout(run, ms))
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  // Stage size.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Half screen (the login layout's container breakpoint): the stage sits above the form.
    const layoutRoot = el.closest('.login-variant-root')
    const update = () => {
      const rect = el.getBoundingClientRect()
      const compact = (layoutRoot?.getBoundingClientRect().width ?? window.innerWidth) <= 959
      if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height, compact })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (layoutRoot) observer.observe(layoutRoot)
    return () => observer.disconnect()
  }, [])

  const camera = useMemo(
    () => (size.w > 0 && size.h > 0 ? computeDozeCamera(size.w, size.h, size.compact) : null),
    [size.w, size.h, size.compact],
  )
  const scene = useMemo(() => (camera ? computeDozeScene(size.w, size.h, camera) : null), [camera, size.w, size.h])

  // Tell the layout where she is drawn (follows every resize).
  const mateCx = scene?.mate.cx
  const mateWidth = scene?.mate.width
  const onMateFrameRef = useRef(onMateFrame)
  useEffect(() => {
    onMateFrameRef.current = onMateFrame
  }, [onMateFrame])
  useEffect(() => {
    onMateFrameRef.current?.(mateCx === undefined || mateWidth === undefined ? null : { cx: mateCx, width: mateWidth })
  }, [mateCx, mateWidth])

  // Renderer: created with the preview's default options, so on leaving /login the warm pool hands this model to the
  // first mate preview (내 메이트, 메이트 상세) instead of loading it again, and a return to /login takes it back.
  useEffect(() => {
    const host = engineHostRef.current
    if (source.kind !== 'aliving' || !host) {
      setEngineStatus('error')
      return
    }
    setEngineStatus('loading')
    const poolKey = warmKey(source)
    const owner = mateWarmPool.generation()
    const renderer =
      mateWarmPool.claim(poolKey) ??
      new AlivingRenderer({
        modelUrl: source.modelUrl,
        engineUrl: source.engineUrl,
        playerUrl: source.playerUrl,
        reactionsUrl: source.reactionsUrl,
      })
    rendererRef.current = renderer
    renderer.attach(host)
    // A player without `track` cannot doze: the stills tell the story instead.
    const sync = () => {
      const status = renderer.getStatus()
      const next = status === 'ready' && !renderer.canTrack() ? 'error' : status
      setEngineStatus(next)
      if (next !== 'ready') liveLostRef.current()
    }
    const unsub = renderer.subscribe(sync)
    if (renderer.getStatus() !== 'loading') queueMicrotask(sync)
    return () => {
      unsub()
      rendererRef.current = null
      liveShownRef.current = false
      setLiveShown(false)
      // Hand the face back neutral: tracked values lapse on their own within a moment anyway.
      renderer.track({ ParamEyeLOpen: 1, ParamEyeROpen: 1, ParamAngleX: 0, ParamAngleY: 0, ParamAngleZ: 0, ParamMouthOpenY: 0 })
      mateWarmPool.park(poolKey, renderer, owner)
    }
  }, [source])

  useEffect(() => {
    if (camera) rendererRef.current?.setView(camera.view.zoom, camera.view.cx, camera.view.cy)
  }, [camera, engineStatus])

  const engineReady = engineStatus === 'ready'

  // Live model late (slow network): fetch the other stills in case she is woken before it is ready.
  const showAllStills = allStills || engineStatus === 'error'
  useEffect(() => {
    if (showAllStills || liveShown) return
    const id = window.setTimeout(() => setAllStills(true), 1500)
    return () => window.clearTimeout(id)
  }, [showAllStills, liveShown])

  // Pose loop: while the model is ready it gets a dozing / waking / falling-asleep pose every frame.
  useEffect(() => {
    if (!engineReady) return
    const lean = engineHostRef.current
    return startFrameLoop(window, (now) => {
      const renderer = rendererRef.current
      if (!renderer?.canTrack()) return
      const current = phaseRef.current
      let params: TrackParams | null = null
      let leanValue = 0
      if (current === 'dozing') {
        const pose = dozePose(now - nodStartRef.current)
        params = pose.params
        leanValue = pose.lean
      } else if (current === 'waking' && liveShownRef.current) {
        params = wakePose(now - wakeStartRef.current, wakeFromRef.current)
      } else if (current === 'falling' && liveShownRef.current) {
        const t = now - fallStartRef.current
        if (t >= DOZE_TIMINGS_MS.fallAsleep) {
          nodStartRef.current = now
          setPhase('dozing')
          params = dozePose(0).params
          leanValue = 1
        } else {
          params = fallAsleepPose(t)
          leanValue = t / DOZE_TIMINGS_MS.fallAsleep
        }
      }
      if (params) {
        renderer.track(params)
        lastPoseRef.current = params
      }
      lean?.style.setProperty('--doze-lean', reducedMotion ? '0' : leanValue.toFixed(3))
    })
  }, [engineReady, reducedMotion, setPhase])

  // Live2D takes over from the still once it is ready and posed (never in the middle of a still wake-up).
  useEffect(() => {
    if (!engineReady || liveShown || phase === 'waking' || phase === 'falling') return
    const renderer = rendererRef.current
    if (phase === 'dozing') {
      // The nod cycle starts at the still's pose, so the crossfade has no jump.
      nodStartRef.current = performance.now()
      renderer?.setExpression(null)
      renderer?.lookAt(0, 0)
    } else {
      renderer?.setExpression(shy ? 'shy' : 'happy')
    }
    const id = window.setTimeout(() => {
      liveShownRef.current = true
      setLiveShown(true)
    }, 140)
    return () => window.clearTimeout(id)
  }, [engineReady, liveShown, phase, shy])

  /** Cursor (viewport px) → gaze for the current framing. */
  const gazeFor = useCallback(
    (pointer: { x: number; y: number }): { x: number; y: number } => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect || !scene) return { x: 0.22, y: 0 }
      return computePointerGaze({
        pointerX: pointer.x,
        pointerY: pointer.y,
        faceX: rect.left + scene.face.x,
        faceY: rect.top + scene.face.y,
        stageWidth: rect.width,
        stageHeight: rect.height,
      })
    },
    [scene],
  )

  const finishWake = useCallback(() => {
    setHint('none')
    setPhase('awake')
    setAnnounce('채린이가 깨어났어요')
    onAwakeChangeRef.current(true, reducedMotion)
    onGreetRef.current(DOZE_GREETING)
  }, [reducedMotion, setPhase])

  // DEV `doze=awake`: start already awake (review captures of the awake screen), once.
  const forcedAwakeRef = useRef(false)
  useEffect(() => {
    if (!devQuery.forceAwake || forcedAwakeRef.current) return
    forcedAwakeRef.current = true
    setStill('happy')
    finishWake()
  }, [devQuery.forceAwake, finishWake])

  const wake = useCallback(
    (method: WakeMethod) => {
      if (phaseRef.current !== 'dozing' && phaseRef.current !== 'falling') return
      clearTimers()
      setAnnounce('')
      wakeStartRef.current = performance.now()
      wakeFromRef.current = lastPoseRef.current
      setPhase('waking')
      const live = liveShownRef.current
      emitLoginDesktopEvent({ name: 'login_doze_woken', payload: { method, mode: live ? 'live' : 'static' } })
      if (live) {
        const renderer = rendererRef.current
        for (const cue of WAKE_EXPRESSION_CUES) {
          later(cue.at, () => {
            if (cue.expression === null) {
              // Looks at you (the cursor if there is one, else toward the form) while the yawn fades.
              const pointer = lastPointerRef.current
              const gaze = pointer ? gazeFor(pointer) : { x: 0.22, y: 0 }
              renderer?.lookAt(gaze.x, gaze.y)
            }
            renderer?.setExpression(cue.expression)
          })
        }
        later(wakeGreetDelay('live', reducedMotion), finishWake)
        return
      }
      setAllStills(true)
      if (reducedMotion) {
        setStill('happy')
      } else {
        later(DOZE_TIMINGS_MS.staticYawnAt, () => setStill('yawn'))
        later(DOZE_TIMINGS_MS.staticHappyAt, () => setStill('happy'))
      }
      later(wakeGreetDelay('static', reducedMotion), finishWake)
    },
    [clearTimers, finishWake, gazeFor, later, reducedMotion, setPhase],
  )

  const fallAsleep = useCallback(() => {
    if (phaseRef.current !== 'awake') return
    clearTimers()
    setShy(false)
    onAwakeChangeRef.current(false, reducedMotion)
    setAnnounce('채린이가 다시 졸고 있어요')
    if (liveShownRef.current) {
      rendererRef.current?.setExpression(null)
      rendererRef.current?.lookAt(0, 0)
      fallStartRef.current = performance.now()
      setPhase('falling')
    } else {
      nodStartRef.current = performance.now()
      setPhase('dozing')
    }
    setStill('doze')
  }, [clearTimers, reducedMotion, setPhase])

  /**
   * The live model was shown and then stopped being ready (frame error, lost GPU): hide the canvas, drop any live wake
   * cues and let the stills carry on in the state she is in (see recoverFromLiveLoss).
   */
  const handleLiveLost = useCallback(() => {
    if (!liveShownRef.current) return
    liveShownRef.current = false
    setLiveShown(false)
    setAllStills(true)
    const recovery = recoverFromLiveLoss(phaseRef.current)
    if (phaseRef.current === 'waking') clearTimers()
    setStill(recovery.still)
    if (recovery.phase === 'dozing' && phaseRef.current !== 'dozing') {
      nodStartRef.current = performance.now()
      setPhase('dozing')
    }
    if (recovery.finishWake) finishWake()
  }, [clearTimers, finishWake, setPhase])
  useEffect(() => {
    liveLostRef.current = handleLiveLost
  }, [handleLiveLost])

  // Dozing: wake on her own after a while; show the "how to wake" hint after a moment.
  useEffect(() => {
    if (phase !== 'dozing') return
    const auto = window.setTimeout(() => wake('auto'), DOZE_TIMINGS_MS.autoWake)
    const hintTimer = window.setTimeout(() => setHint((h) => (h === 'none' ? 'pointer' : h)), 1200)
    return () => {
      window.clearTimeout(auto)
      window.clearTimeout(hintTimer)
    }
  }, [phase, wake])

  // Coming close: the cursor stays near her face for a moment.
  useEffect(() => {
    if (phase !== 'dozing' || !scene) return
    let dwell: number | undefined
    const radius = Math.max(120, 230 * scene.k)
    const onMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const near = isPointerNearFace(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        scene.face,
        radius,
      )
      if (near && dwell === undefined) dwell = window.setTimeout(() => wake('near'), DOZE_TIMINGS_MS.nearDwell)
      else if (!near && dwell !== undefined) {
        window.clearTimeout(dwell)
        dwell = undefined
      }
    }
    const off = listenAll(window, ['pointermove'], onMove, { passive: true })
    return () => {
      off()
      if (dwell !== undefined) window.clearTimeout(dwell)
    }
  }, [phase, scene, wake])

  // Keyboard: the first key press is the keyboard user "coming close" (focus starts on the form's heading, so her
  // button is only reachable with Shift+Tab; Enter / Space on it also wake her, see handleHit).
  useEffect(() => {
    if (phase !== 'dozing') return
    const onKey = (event: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return
      // Enter / Space on her own button arrive as its click.
      if (event.target === hitRef.current) return
      wake('keyboard')
    }
    return listenAll(window, ['keydown'], onKey)
  }, [phase, wake])

  // Awake: no pointer or keyboard input for a while → she dozes off again (not while a field has focus).
  useEffect(() => {
    if (phase !== 'awake') return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const active = document.activeElement
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) arm()
        else fallAsleep()
      }, DOZE_TIMINGS_MS.redozeIdle)
    }
    const off = listenAll(window, ['pointermove', 'pointerdown', 'keydown', 'wheel'], arm, { passive: true })
    arm()
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [phase, fallAsleep])

  // Awake + live: expressions follow the login reactions (and a tap makes her shy for a moment).
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !liveShown || phase !== 'awake') return
    renderer.setExpression(shy ? 'shy' : reactionExpression(reactionState))
    if (reactionState === 'emailFocus') renderer.lookAt(0.22, 0)
    if (reactionState === 'passwordFocus') {
      const gaze = resolveGazeForState('passwordFocus', 1, {
        eyeScale: DEFAULT_DESKTOP_CONTROLS.eyeGazeScale,
        headScale: DEFAULT_DESKTOP_CONTROLS.headGazeScale,
      })
      if (gaze.kind === 'fixed') renderer.lookAt(gaze.x, gaze.y)
    }
  }, [reactionState, reactionNonce, liveShown, phase, shy])

  // Awake + live: she follows the cursor across the window.
  const followCursor =
    phase === 'awake' && liveShown && !reducedMotion && reactionState !== 'emailFocus' && reactionState !== 'passwordFocus'
  useEffect(() => {
    if (!followCursor || !scene) return
    let raf: number | null = null
    let pending: { x: number; y: number } | null = null
    const flush = () => {
      raf = null
      if (!pending || document.hidden) return
      const gaze = gazeFor(pending)
      rendererRef.current?.lookAt(gaze.x, gaze.y)
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      pending = { x: event.clientX, y: event.clientY }
      lastPointerRef.current = pending
      if (raf === null) raf = requestAnimationFrame(flush)
    }
    const off = listenAll(window, ['pointermove'], onMove, { passive: true })
    return () => {
      off()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [followCursor, scene, gazeFor])

  // Tap while awake: shy for a moment.
  useEffect(() => {
    if (!shy) return
    const id = window.setTimeout(() => setShy(false), DOZE_TIMINGS_MS.shyHold)
    return () => window.clearTimeout(id)
  }, [shy])

  const handleHit = (event: MouseEvent<HTMLButtonElement>) => {
    if (phaseRef.current === 'awake') {
      setShy(true)
      return
    }
    // Enter / Space arrive as a click with `detail === 0`.
    wake(event.detail === 0 ? 'keyboard' : 'tap')
  }
  const handleHitFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'dozing') return
    if (event.currentTarget.matches(':focus-visible')) setHint('keyboard')
  }
  const handleHitBlur = () => setHint((h) => (h === 'keyboard' ? (phaseRef.current === 'dozing' ? 'pointer' : 'none') : h))

  const shownStill: StillName = phase === 'awake' && shy ? 'shy' : still
  const dozing = phase === 'dozing' || phase === 'falling'
  const screenAwake = phase === 'waking' || phase === 'awake'

  const box = (b: { left: number; top: number; width: number; height: number }): CSSProperties => ({
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
  })

  return (
    <div
      ref={rootRef}
      className="doze-stage-root"
      data-doze-phase={phase}
      data-doze-mode={liveShown ? 'live' : 'static'}
      data-live2d-status={source.kind === 'aliving' ? engineStatus : 'off'}
      data-reduced={reducedMotion || undefined}
      data-mate-cx={scene ? scene.mate.cx.toFixed(1) : undefined}
    >
      <div className="doze-stage-mask">
        {/* Laptop screen light on her face (the screen faces her; we see the lid from behind). */}
        {scene && (
          <i
            className="doze-face-light"
            aria-hidden="true"
            data-awake={screenAwake || undefined}
            style={{ left: `${scene.face.x}px`, top: `${scene.face.y + 70 * scene.k}px`, width: `${520 * scene.k}px`, height: `${460 * scene.k}px` }}
          />
        )}

        {/* Stills: doze / yawn / happy (+ shy) crossfade. Kept under the canvas as the loading and fallback picture. */}
        {scene && (
          <div className="doze-stills" aria-hidden="true" data-hidden={liveShown || undefined}>
            {(showAllStills ? (Object.keys(STILLS) as StillName[]) : (['doze'] as const)).map((name) => (
              <img
                key={name}
                src={STILLS[name]}
                alt=""
                className="doze-still"
                data-still={name}
                data-visible={shownStill === name || undefined}
                data-nodding={(name === 'doze' && phase === 'dozing' && !reducedMotion) || undefined}
                draggable={false}
                decoding="async"
                // The doze still is /login's LCP picture: high priority, and fetched in CORS mode like its preload
                // (index.html, server/login-still-preload.ts) and the screen light's CSS mask, so it downloads once.
                {...(name === 'doze' ? { fetchPriority: 'high' as const, crossOrigin: 'anonymous' as const } : {})}
                style={box(scene.still)}
              />
            ))}
          </div>
        )}

        {/* Aliving2D canvas: transparent until posed, then fades in over the still. */}
        <div ref={engineHostRef} className="doze-engine-host" aria-hidden="true" data-visible={liveShown || undefined} />

        {/* The laptop screen (facing her) lights her chin, neck and chest from below: a cool lavender light, masked to
            her silhouette so it never washes the room. */}
        {scene && (
          <i
            className="doze-screen-light"
            aria-hidden="true"
            data-awake={screenAwake || undefined}
            style={{ ...box(scene.still), WebkitMaskImage: `url(${dozeStillUrl})`, maskImage: `url(${dozeStillUrl})` }}
          />
        )}

        {scene && (
          <DozeDesk
            scene={scene}
            width={size.w}
            height={size.h}
            screenOn={screenAwake}
            // Only once Live2D runs: that proves WebGL2 works, and reduced motion / still path never get here.
            heatmap={engineReady}
          />
        )}
      </div>

      {/* Big z → z → Z rising beside her head; they scatter the moment she wakes. */}
      {scene && (dozing || phase === 'waking') && (
        <div
          className="doze-zz"
          aria-hidden="true"
          data-leaving={phase === 'waking' || undefined}
          style={{ left: `${scene.zz.x}px`, top: `${scene.zz.y}px`, '--k': scene.k } as CSSProperties}
        >
          <span>z</span>
          <span>z</span>
          <span>Z</span>
        </div>
      )}

      {scene && (
        <button
          ref={hitRef}
          type="button"
          className="doze-hit"
          style={box(scene.hit)}
          aria-label={phase === 'awake' ? `${mate.name}에게 장난치기` : `졸고 있는 ${mate.name} 깨우기`}
          aria-disabled={phase === 'waking' || undefined}
          onClick={handleHit}
          onFocus={handleHitFocus}
          onBlur={handleHitBlur}
        />
      )}

      {/* "Tap her" bubble on her chest, pointing up at her (clicks fall through to her button underneath). Keyboard
          users wake her with their first key press, so the line only changes when her button itself has focus. */}
      {scene && (phase === 'dozing' || phase === 'waking') && hint !== 'none' && (
        <div
          className="doze-call"
          aria-hidden="true"
          data-keyboard={hint === 'keyboard' || undefined}
          data-leaving={phase === 'waking' || undefined}
          style={{ left: `${scene.call.x}px`, top: `${scene.call.y}px` }}
        >
          <svg className="doze-call-hand" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M9.5 11V4.75a1.75 1.75 0 0 1 3.5 0V10l4.1.85a2.4 2.4 0 0 1 1.85 2.73l-.62 4.02A3 3 0 0 1 15.36 20H11.1a3 3 0 0 1-2.36-1.15l-3.1-3.97a1.6 1.6 0 0 1 2.32-2.18L9.5 14z"
              fill="currentColor"
            />
          </svg>
          <span>{hint === 'keyboard' ? DOZE_KEY_LINE : dozeCallLine(mate.name)}</span>
        </div>
      )}

      {phase === 'awake' && (
        <button
          type="button"
          className="doze-replay-btn"
          onClick={() => {
            emitLoginDesktopEvent({ name: 'login_doze_replayed', payload: {} })
            fallAsleep()
          }}
        >
          다시 보기
        </button>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </span>
    </div>
  )
}
