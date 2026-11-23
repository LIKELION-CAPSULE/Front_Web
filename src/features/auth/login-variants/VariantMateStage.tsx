import { useEffect, useRef, useState } from 'react'
import type { Live2DStage, Live2DStatus } from '@/features/live2d/live2d-stage'
import '@/features/live2d/live2d.css'
import {
  DEFAULT_DESKTOP_CONTROLS,
  type ExpressionMapping,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import type { LoginMateProfile } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import {
  buildExpressionRequestForState,
  resolveGazeForState,
} from '@/features/auth/login-backgrounds/desktop/mate-reactions'

/**
 * Full-bleed Live2D close-up for the "얼굴 크게" login concept.
 * Same model, expressions and gaze rules as the desktop call window; only the framing differs.
 * The form sits to the right, so fixed gazes look right (+1).
 */
type StageInputs = { reactionState: MateReactionState; speech: string | null; expressions: ExpressionMapping }

function applyState(stage: Live2DStage, cur: StageInputs) {
  const gaze = resolveGazeForState(cur.reactionState, 1, {
    eyeScale: DEFAULT_DESKTOP_CONTROLS.eyeGazeScale,
    headScale: DEFAULT_DESKTOP_CONTROLS.headGazeScale,
  })
  if (gaze.kind === 'fixed') stage.lookAt(gaze.x, gaze.y, gaze.options)
  else stage.clearLookOverride()
  const request = buildExpressionRequestForState(cur.reactionState, cur.expressions, cur.speech)
  stage.setExpression(request.file)
}

export const PORTRAIT_LAYOUT = { scale: 2.4, offsetX: 0, offsetY: 35 } as const

export function VariantMateStage({
  mate,
  allowLive2D,
  reactionState,
  reactionNonce,
  speech,
  expressions,
  hideFallback = false,
  visibleOverride,
  onStatusChange,
}: {
  mate: LoginMateProfile
  allowLive2D: boolean
  reactionState: MateReactionState
  reactionNonce: number
  speech: string | null
  expressions: ExpressionMapping
  hideFallback?: boolean
  visibleOverride?: boolean
  onStatusChange?: (status: Live2DStatus) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Live2DStage | null>(null)
  const [status, setStatus] = useState<Live2DStatus>('loading')
  const latest = useRef({ reactionState, speech, expressions })
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    latest.current = { reactionState, speech, expressions }
  }, [reactionState, speech, expressions])
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const shouldLoad = allowLive2D && mate.model !== null

  useEffect(() => {
    if (!shouldLoad) {
      onStatusChangeRef.current?.('error')
    }
  }, [shouldLoad])

  useEffect(() => {
    const host = hostRef.current
    if (!shouldLoad || !mate.model || !host) return
    let cancelled = false
    let stage: Live2DStage | null = null
    let unsubscribe: (() => void) | null = null
    const onVisibility = () => stage?.setPaused(document.hidden)
    void import('@/features/live2d/live2d-stage')
      .then(({ Live2DStage: StageClass }) => {
        if (cancelled) return
        stage = new StageClass(
          mate.model!.modelJsonUrl,
          PORTRAIT_LAYOUT,
          new URL(import.meta.env.BASE_URL, window.location.href).href,
        )
        stageRef.current = stage
        stage.attach(host)
        stage.setTracking(true)
        unsubscribe = stage.subscribe(() => {
          const next = stage!.getStatus()
          setStatus(next)
          onStatusChangeRef.current?.(next)
          if (next === 'ready') applyState(stage!, latest.current)
        })
        document.addEventListener('visibilitychange', onVisibility)
        onVisibility()
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          onStatusChangeRef.current?.('error')
        }
      })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribe?.()
      if (stage) {
        stage.detach(host)
        stage.destroy()
      }
      stageRef.current = null
      setStatus('loading')
    }
  }, [shouldLoad, mate.model])

  useEffect(() => {
    const stage = stageRef.current
    if (stage && status === 'ready') applyState(stage, { reactionState, speech, expressions })
  }, [reactionState, reactionNonce, speech, expressions, status])

  const ready = shouldLoad && status === 'ready'
  const isVisible = visibleOverride !== undefined ? visibleOverride && ready : ready

  return (
    <div className="login-variant-portrait-stage" data-mate-mode={isVisible ? 'live2d' : 'static'}>
      {!hideFallback && (
        <img src={mate.portraitImage} alt="" aria-hidden="true" className="login-variant-portrait-fallback" draggable={false} />
      )}
      {shouldLoad && (
        <div className="login-variant-portrait-live2d" data-visible={isVisible}>
          <div ref={hostRef} aria-hidden="true" className="live2d-host" data-status={status} style={{ background: 'transparent' }} />
        </div>
      )}
    </div>
  )
}
