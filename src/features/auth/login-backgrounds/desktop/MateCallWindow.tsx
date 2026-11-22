import { useEffect, useRef, useState } from 'react'
import {
  advanceExpression,
  createExpressionSchedule,
  nextExpressionDeadline,
  requestExpression,
  type ExpressionSchedule,
} from '@/features/live2d/expression-scheduler'
import type { Live2DStage, Live2DStatus } from '@/features/live2d/live2d-stage'
import { CALL_STAGE_GRADIENT } from '@/features/mates/artwork'
import '@/features/live2d/live2d.css'
import { DesktopWindow } from './DesktopWindow'
import {
  SHINY_CAPSULE_CONFIG,
  type ExpressionMapping,
  type MateReactionState,
} from './desktop-config'
import type { LoginMateProfile } from './login-mate-source'
import { buildExpressionRequestForState, resolveGazeForState } from './mate-reactions'

interface MateCallWindowProps {
  mate: LoginMateProfile
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  active: boolean
  allowLive2D: boolean
  compact?: boolean
  draggable?: boolean
  reactionState: MateReactionState
  reactionNonce: number
  speechBubble: string | null
  expressionMapping: ExpressionMapping
  relativeLoginDir: number
  eyeGazeScale: number
  headGazeScale: number
  secretTarget: { x: number; y: number } | null
  onMove: (x: number, y: number) => void
  onFocus: () => void
  onDragStateChange: (dragging: boolean) => void
}

export function MateCallWindow({
  mate,
  x,
  y,
  width,
  height,
  zIndex,
  active,
  allowLive2D,
  compact = false,
  draggable = true,
  reactionState,
  reactionNonce,
  speechBubble,
  expressionMapping,
  relativeLoginDir,
  eyeGazeScale,
  headGazeScale,
  secretTarget,
  onMove,
  onFocus,
  onDragStateChange,
}: MateCallWindowProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Live2DStage | null>(null)
  const [status, setStatus] = useState<Live2DStatus>('loading')
  const scheduleRef = useRef<ExpressionSchedule>(createExpressionSchedule())
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const latestRef = useRef({
    reactionState,
    relativeLoginDir,
    expressionMapping,
    speechBubble,
    eyeGazeScale,
    headGazeScale,
    secretTarget,
  })

  useEffect(() => {
    latestRef.current = {
      reactionState,
      relativeLoginDir,
      expressionMapping,
      speechBubble,
      eyeGazeScale,
      headGazeScale,
      secretTarget,
    }
  }, [
    reactionState,
    relativeLoginDir,
    expressionMapping,
    speechBubble,
    eyeGazeScale,
    headGazeScale,
    secretTarget,
  ])

  const shouldLoadLive2D = allowLive2D && mate.model !== null

  // Dynamically import and mount Live2DStage strictly inside effect (keeps PixiJS/Live2D out of initial LoginPage chunk)
  useEffect(() => {
    const model = mate.model
    if (!shouldLoadLive2D || !model) {
      return
    }
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let stage: Live2DStage | null = null
    let unsubscribe: (() => void) | null = null
    let onVisibility: (() => void) | null = null

    void import('@/features/live2d/live2d-stage')
      .then(({ Live2DStage: StageClass }) => {
        if (cancelled) return
        const created = new StageClass(
          model.modelJsonUrl,
          { scale: model.scale, offsetX: model.offsetX, offsetY: model.offsetY },
          new URL(import.meta.env.BASE_URL, window.location.href).href,
        )
        const w = window as unknown as {
          __capsuleDesktopMetrics?: { webglContextCount: number; live2dLoadCount: number }
        }
        w.__capsuleDesktopMetrics ??= { webglContextCount: 0, live2dLoadCount: 0 }
        w.__capsuleDesktopMetrics.live2dLoadCount += 1
        stage = created
        stageRef.current = created
        created.attach(host)
        created.setTracking(true)

        const syncGaze = () => {
          const cur = latestRef.current
          const gaze = resolveGazeForState(cur.reactionState, cur.relativeLoginDir, {
            eyeScale: cur.eyeGazeScale,
            headScale: cur.headGazeScale,
            secretTarget: cur.secretTarget,
          })
          if (gaze.kind === 'fixed') created.lookAt(gaze.x, gaze.y, gaze.options)
          else created.clearLookOverride()
        }
        syncGaze()

        unsubscribe = created.subscribe(() => {
          const nextStatus = created.getStatus()
          setStatus(nextStatus)
          if (nextStatus === 'ready') {
            syncGaze()
            const cur = latestRef.current
            const req = buildExpressionRequestForState(
              cur.reactionState,
              cur.expressionMapping,
              cur.speechBubble,
            )
            if (req.file) created.setExpression(req.file)
          }
        })

        onVisibility = () => {
          created.setPaused(document.hidden)
        }
        document.addEventListener('visibilitychange', onVisibility)
        onVisibility()
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
      unsubscribe?.()
      if (stage) {
        stage.detach(host)
        stage.destroy()
        if (stageRef.current === stage) stageRef.current = null
      }
      setStatus('loading')
    }
  }, [shouldLoadLive2D, mate.model])

  // Apply gaze override or cursor tracking whenever state or calibration changes
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const gaze = resolveGazeForState(reactionState, relativeLoginDir, {
      eyeScale: eyeGazeScale,
      headScale: headGazeScale,
      secretTarget,
    })
    if (gaze.kind === 'fixed') {
      stage.lookAt(gaze.x, gaze.y, gaze.options)
    } else {
      stage.clearLookOverride()
    }
  }, [reactionState, relativeLoginDir, eyeGazeScale, headGazeScale, secretTarget, status])

  // Apply expression through expression-scheduler so faces obey hold & priority without flickering
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    clearTimeout(deadlineTimerRef.current)

    const scheduleStep = (now: number) => {
      const deadline = nextExpressionDeadline(scheduleRef.current)
      if (deadline === null) return
      const waitMs = Math.max(16, deadline - now)
      deadlineTimerRef.current = setTimeout(() => {
        const tickNow = performance.now()
        const advanced = advanceExpression(scheduleRef.current, tickNow)
        scheduleRef.current = advanced.schedule
        if (advanced.command) {
          stage.setExpression(advanced.command.file)
        }
        scheduleStep(tickNow)
      }, waitMs)
    }

    const now = performance.now()
    const request = buildExpressionRequestForState(reactionState, expressionMapping, speechBubble)
    const result = requestExpression(scheduleRef.current, request, now)
    scheduleRef.current = result.schedule
    if (result.command) {
      stage.setExpression(result.command.file)
    }
    scheduleStep(now)

    let shinyFollowUpTimer: ReturnType<typeof setTimeout> | undefined
    if (reactionState === 'shinyFound') {
      shinyFollowUpTimer = setTimeout(() => {
        if (latestRef.current.reactionState === 'shinyFound') {
          stage.setExpression(SHINY_CAPSULE_CONFIG.followUpSmileFile)
        }
      }, SHINY_CAPSULE_CONFIG.followUpSmileDelayMs)
    }

    return () => {
      clearTimeout(deadlineTimerRef.current)
      clearTimeout(shinyFollowUpTimer)
    }
  }, [reactionState, reactionNonce, expressionMapping, speechBubble, status])

  const [bgFailed, setBgFailed] = useState(false)
  const live2dReady = shouldLoadLive2D && status === 'ready'

  return (
    <DesktopWindow
      id="mate-call"
      x={x}
      y={y}
      width={width}
      height={height}
      zIndex={zIndex}
      active={active}
      draggable={draggable}
      className={compact ? 'desktop-mate-window--compact' : undefined}
      showControls={true}
      onMove={onMove}
      onFocus={onFocus}
      onDragStateChange={onDragStateChange}
      bodyClassName="desktop-mate-body"
      title={
        <span className="desktop-mate-title">
          <span className="desktop-mate-dot" aria-hidden="true" />
          <span>{mate.name} · 연결 대기 중</span>
        </span>
      }
      titleRight={<span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>}
    >
      {/* Full-bleed video call stage directly below title bar */}
      <div
        className="desktop-mate-stage"
        data-mate-mode={live2dReady ? 'live2d' : 'static'}
        style={{ background: CALL_STAGE_GRADIENT }}
      >
        {/* Room background (portrait, object-fit: cover, center 40%); falls back to violet gradient */}
        {mate.callBackgroundImage && !bgFailed && (
          <img
            src={mate.callBackgroundImage}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="desktop-mate-bg-img"
            draggable={false}
            onError={() => setBgFailed(true)}
          />
        )}

        {/* Static portrait renders immediately on first paint; Live2D fades in smoothly on top */}
        <div className="desktop-mate-fallback" aria-hidden={live2dReady}>
          <img
            src={mate.portraitImage}
            alt=""
            aria-hidden="true"
            className="desktop-mate-fallback-img"
            draggable={false}
          />
        </div>

        {shouldLoadLive2D && (
          <div className="desktop-mate-live2d-slot" data-visible={live2dReady}>
            <div
              ref={hostRef}
              aria-hidden="true"
              className="live2d-host"
              data-status={status}
              style={{ background: 'transparent' }}
            />
          </div>
        )}

        {/* Compact 96×72 self-cam tile in top-right corner so it never covers body/tie or subtitles */}
        <div className="desktop-mate-selfcam" aria-label="내 카메라 꺼짐">
          <div className="desktop-mate-selfcam-avatar" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8.5" r="3.4" fill="currentColor" fillOpacity="0.58" />
              <path
                d="M5.5 19.2C6.4 15.8 8.9 14.2 12 14.2C15.1 14.2 17.6 15.8 18.5 19.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeOpacity="0.58"
              />
            </svg>
          </div>
          <span className="desktop-mate-selfcam-tag">
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
              <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
              <path d="m2 2 20 20" />
            </svg>
            <span>내 캠</span>
          </span>
        </div>

        {/* Bottom-center subtitle speech bubble (configurable per mate, stays well below upper 55% face) */}
        <div
          className="desktop-mate-bubble-slot"
          data-align={mate.bubblePosition.align}
          aria-live="polite"
          aria-atomic="true"
          style={{
            bottom: `${mate.bubblePosition.bottomPx}px`,
            maxWidth: `${mate.bubblePosition.maxWidthPercent}%`,
          }}
        >
          {speechBubble && (
            <div className="desktop-mate-bubble" role="status">
              {speechBubble}
            </div>
          )}
        </div>
      </div>
    </DesktopWindow>
  )
}
