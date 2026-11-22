import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ModelInfo } from '@/shared/api/types'
import { useBackend } from '@/features/backend/backend-context'
import { useSharedWallpaper } from '@/app/components/shared-wallpaper-context'
import { useAvatarModel } from '@/features/live2d/use-avatar-model'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import {
  advanceExpression,
  createExpressionSchedule,
  nextExpressionDeadline,
  requestExpression,
  type ExpressionSchedule,
} from '@/features/live2d/expression-scheduler'
import { CALL_STAGE_GRADIENT, chaerinArtwork, mateHeroPortrait } from '@/features/mates/artwork'
import {
  DEFAULT_EXPRESSION_MAPPING,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import {
  buildExpressionRequestForState,
  getDefaultLineForState,
  reactionBubbleDurationMs,
} from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { CharacterSpeechBubble } from '@/features/session/components/CharacterSpeechBubble'
import { Button } from '@/shared/ui/Button'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import type { VoiceSampleStatus } from './VoiceSampleButton'

export function MatePreview({
  mateId,
  model,
  scope,
  image,
  name,
  paused,
  ctaActive = false,
  audioStatus = 'idle',
  suppressSpeech = false,
  mode = 'detail',
  staticSpeech,
  initialExpression = 'smile',
  overrideExpression,
  showAgeBadge = true,
  stageClassName,
  controlBar,
  onRetry,
}: {
  mateId: string
  model?: ModelInfo
  scope: string
  image?: string
  name: string
  paused: boolean
  ctaActive?: boolean
  audioStatus?: VoiceSampleStatus
  suppressSpeech?: boolean
  mode?: 'detail' | 'record'
  staticSpeech?: string
  initialExpression?: 'smile' | 'celebrate'
  overrideExpression?: string | null
  showAgeBadge?: boolean
  stageClassName?: string
  controlBar?: ReactNode
  onRetry: () => void
}) {
  const { previewModelFactory } = useBackend()
  const sharedWallpaper = useSharedWallpaper()
  const reduced = useReducedMotion()
  const lowPower = Boolean(sharedWallpaper?.lowPower || (sharedWallpaper && sharedWallpaper.degradationStage >= 3))
  const effectiveModel = reduced || lowPower ? undefined : model
  const { stage, status, retry } = useAvatarModel(effectiveModel, scope, previewModelFactory)
  const [bgFailed, setBgFailed] = useState(false)

  // Reaction state machine (reuses existing greet / idleLong / error lines & expressions)
  const [reactionState, setReactionState] = useState<MateReactionState>('idle')
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)
  const reactionStateRef = useRef<MateReactionState>('idle')
  const scheduleRef = useRef<ExpressionSchedule>(createExpressionSchedule())
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const idleLongTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const emitReaction = useCallback((next: MateReactionState, showLine = true) => {
    reactionStateRef.current = next
    setReactionState(next)
    if (!showLine) return
    const line = getDefaultLineForState(next)
    if (!line) return
    clearTimeout(bubbleTimerRef.current)
    setSpeechBubble(line)
    bubbleTimerRef.current = setTimeout(() => {
      setSpeechBubble(null)
    }, reactionBubbleDurationMs(line))
  }, [])

  const isRecord = mode === 'record'
  const effectiveSuppressSpeech = suppressSpeech || status === 'error' || isRecord
  const canGreet = !effectiveSuppressSpeech && status !== 'loading'

  // Clear bubble and reset reaction state immediately if detail or model load fails
  useEffect(() => {
    if (!effectiveSuppressSpeech) return
    clearTimeout(bubbleTimerRef.current)
    reactionStateRef.current = 'idle'
    const frame = requestAnimationFrame(() => {
      setReactionState('idle')
      setSpeechBubble(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [effectiveSuppressSpeech])

  // Initial greet once ready (or static idle); re-triggers after retry recovers from model error
  useEffect(() => {
    if (!canGreet) return
    const timer = setTimeout(() => {
      if (reactionStateRef.current === 'idle') {
        emitReaction('greet', true)
      }
    }, 650)
    return () => clearTimeout(timer)
  }, [canGreet, emitReaction])

  // 20s inactivity -> existing idleLong
  useEffect(() => {
    if (!canGreet) return
    const resetIdle = () => {
      clearTimeout(idleLongTimerRef.current)
      if (reactionStateRef.current === 'idleLong') {
        reactionStateRef.current = 'idle'
        setReactionState('idle')
      }
      idleLongTimerRef.current = setTimeout(() => {
        if (reactionStateRef.current === 'idle' || reactionStateRef.current === 'greet') {
          emitReaction('idleLong', true)
        }
      }, 20_000)
    }
    resetIdle()
    window.addEventListener('pointermove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    window.addEventListener('pointerdown', resetIdle, { passive: true })
    return () => {
      clearTimeout(idleLongTimerRef.current)
      window.removeEventListener('pointermove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
      window.removeEventListener('pointerdown', resetIdle)
    }
  }, [canGreet, emitReaction])

  // Voice sample playback error -> existing error reaction
  useEffect(() => {
    if (audioStatus === 'error' && !effectiveSuppressSpeech) {
      const frame = requestAnimationFrame(() => emitReaction('error', true))
      return () => cancelAnimationFrame(frame)
    }
  }, [audioStatus, effectiveSuppressSpeech, emitReaction])

  useEffect(() => {
    return () => {
      clearTimeout(bubbleTimerRef.current)
      clearTimeout(deadlineTimerRef.current)
    }
  }, [])

  // Cursor gaze tracking on Live2D stage
  useEffect(() => {
    stage?.setTracking(!reduced && !paused)
    return () => stage?.setTracking(false)
  }, [stage, reduced, paused])

  // Expression scheduling (smile during CTA hover/focus or voice playback; overrideExpression takes top priority)
  const smiling = ctaActive || audioStatus === 'playing'
  const trimmedOverride = overrideExpression?.trim() || ''
  const defaultRecordExpression =
    initialExpression === 'celebrate' ? DEFAULT_EXPRESSION_MAPPING.shinyFound : DEFAULT_EXPRESSION_MAPPING.greet
  const activeExpression = trimmedOverride || (isRecord ? defaultRecordExpression : smiling ? DEFAULT_EXPRESSION_MAPPING.greet : '')

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('capsule:mate-expression-change', {
        detail: { mateId, expression: activeExpression },
      }),
    )
  }, [mateId, activeExpression])

  useEffect(() => {
    if (!stage || status !== 'ready') return
    clearTimeout(deadlineTimerRef.current)

    const scheduleStep = (now: number) => {
      const deadline = nextExpressionDeadline(scheduleRef.current)
      if (deadline === null) return
      deadlineTimerRef.current = setTimeout(() => {
        const tickNow = performance.now()
        const advanced = advanceExpression(scheduleRef.current, tickNow)
        scheduleRef.current = advanced.schedule
        if (advanced.command) stage.setExpression(advanced.command.file)
        scheduleStep(tickNow)
      }, Math.max(16, deadline - now))
    }

    const now = performance.now()
    const request = trimmedOverride
      ? { file: trimmedOverride, priority: 'state' as const, hold: 'sticky' as const }
      : isRecord
        ? {
            file: defaultRecordExpression,
            priority: 'state' as const,
            hold: 'sticky' as const,
          }
        : smiling
          ? { file: DEFAULT_EXPRESSION_MAPPING.greet, priority: 'state' as const, hold: 'sticky' as const }
          : buildExpressionRequestForState(reactionState, DEFAULT_EXPRESSION_MAPPING, speechBubble)
    const result = requestExpression(scheduleRef.current, request, now)
    scheduleRef.current = result.schedule
    if (result.command) stage.setExpression(result.command.file)
    scheduleStep(now)

    return () => clearTimeout(deadlineTimerRef.current)
  }, [stage, status, isRecord, defaultRecordExpression, trimmedOverride, smiling, reactionState, speechBubble])

  const showLive2D = Boolean(stage) && status === 'ready'
  const fallbackSrc = mateHeroPortrait(mateId, image)

  return (
    <div
      className={stageClassName ? `mate-detail-portrait ${stageClassName}` : 'mate-detail-portrait'}
      data-preview={status}
      data-mate-mode={showLive2D ? 'live2d' : 'static'}
      data-expression={activeExpression || undefined}
      aria-label={`${name} 미리보기`}
      aria-busy={status === 'loading'}
      style={{ background: CALL_STAGE_GRADIENT }}
    >
      {/* Shared portrait room background; falls back to violet gradient */}
      {!bgFailed && (
        <img
          src={chaerinArtwork.callBackground.portrait}
          alt=""
          aria-hidden="true"
          className="desktop-mate-bg-img"
          draggable={false}
          onError={() => setBgFailed(true)}
        />
      )}

      {/* Static transparent portrait fallback (visible when Live2D is absent, loading, failed, or reduced-motion) */}
      {!showLive2D && fallbackSrc && (
        <div className="mate-detail-fallback">
          <img src={fallbackSrc} alt={name} className="mate-detail-fallback-img" draggable={false} />
        </div>
      )}

      {/* Live2D or review preview stage */}
      {stage && status !== 'error' && (
        <div className="mate-detail-live2d-slot" data-visible={showLive2D}>
          <Live2DFigure stage={stage} />
        </div>
      )}

      {showAgeBadge && <span className="mate-age-badge mate-detail-age-badge">전연령</span>}

      {/* Detail mode: reaction speech bubble above control bar */}
      {!effectiveSuppressSpeech && (
        <div
          className="desktop-mate-bubble-slot mate-detail-bubble-slot"
          data-align="center"
          aria-live="polite"
          aria-atomic="true"
        >
          {speechBubble && (
            <div className="desktop-mate-bubble" role="status">
              {speechBubble}
            </div>
          )}
        </div>
      )}

      {/* Record mode: server closingLine in bottom-center pill speech bubble (same style as ConnectionPage) */}
      {isRecord && staticSpeech && status !== 'error' && (
        <div className="connection-record-speech-slot">
          <CharacterSpeechBubble key={staticSpeech} name={name} text={staticSpeech} expanded variant="pill" />
        </div>
      )}

      {/* Bottom-center translucent call control bar (VoiceSampleButton) */}
      {controlBar && <div className="mate-detail-control-bar">{controlBar}</div>}

      {status === 'loading' && (
        <div className="mate-preview-status" role="status">
          <QuarterRingSpinner />
          <span>캐릭터를 불러오고 있어요.</span>
        </div>
      )}
      {status === 'error' && (
        <div className="mate-preview-status" role="alert">
          <span>모델을 불러오지 못했어요.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              retry()
              onRetry()
            }}
          >
            다시 시도
          </Button>
        </div>
      )}
    </div>
  )
}
