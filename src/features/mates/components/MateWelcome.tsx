import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { useSharedWallpaper } from '@/app/components/shared-wallpaper-context'
import { CALL_STAGE_GRADIENT, chaerinArtwork, mateHeroPortrait } from '@/features/mates/artwork'
import {
  advanceExpression,
  createExpressionSchedule,
  nextExpressionDeadline,
  requestExpression,
  type ExpressionSchedule,
} from '@/features/live2d/expression-scheduler'
import type { Live2DStage, Live2DStatus } from '@/features/live2d/live2d-stage'
import { createLoginMateSource } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import {
  DEFAULT_EXPRESSION_MAPPING,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import {
  buildExpressionRequestForState,
  getDefaultLineForState,
  reactionBubbleDurationMs,
} from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import '@/features/live2d/live2d.css'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { withParticle } from '@/shared/lib/korean'
import { mateByName, type AvailableMate } from '../catalog'
import { ConnectMateButton } from './ConnectMateButton'

function isLive2DFallbackScenario(): boolean {
  if (typeof window === 'undefined') return false
  const id =
    document.documentElement.dataset.reviewScenario ??
    (window.name.startsWith('capsule-ui-review:') ? window.name.slice('capsule-ui-review:'.length) : null)
  return id === 'home-live2d-fallback' || id === 'home-lowpower'
}

export function MateWelcome({ mates, onExplore }: { mates: readonly AvailableMate[]; onExplore: () => void }) {
  const { state } = useDemo()
  const { activeSummary } = useBackend()
  const active = mates.find((mate) => state.activeSession?.characterIds.includes(mate.characterId))
  const last =
    active ??
    mateByName(activeSummary?.characterName, mates) ??
    mateByName(state.records.find((record) => record.serverReport)?.characterName, mates)
  const heroMate = last ?? mates[0] ?? null
  const [ctaFocusedOrHovered, setCtaFocusedOrHovered] = useState(false)

  if (!heroMate) {
    return (
      <section
        className="mate-welcome mate-welcome--empty desktop-window desktop-window--active desktop-window--home-enter"
        aria-labelledby="mate-welcome-title"
      >
        <div className="desktop-window-titlebar mate-window-titlebar-static">
          <div className="desktop-window-title-left">CAPSULE</div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls" aria-hidden="true">
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
            </div>
          </div>
        </div>
        <div className="desktop-window-body mate-welcome-body mate-welcome-body--empty">
          <div className="mate-welcome-copy">
            <h1 id="mate-welcome-title">
              노트북 앞의 시간,
              <br />
              <span>함께 보낼 메이트를 골라요</span>
            </h1>
            <Button onClick={onExplore}>
              메이트 둘러보기 <Icon name="arrow" size={18} className="rotate-90" />
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="mate-welcome desktop-window desktop-window--active desktop-window--home-enter"
      aria-labelledby="mate-welcome-title"
    >
      <div className="desktop-window-titlebar mate-window-titlebar-static">
        <div className="desktop-window-title-left">
          <span className="desktop-mate-title">
            <span className="desktop-mate-dot" aria-hidden="true" />
            <span>{heroMate.name} · 연결 대기 중</span>
          </span>
        </div>
        <div className="desktop-window-title-right">
          <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
          <div className="desktop-window-controls" aria-hidden="true">
            <span className="desktop-window-dot" />
            <span className="desktop-window-dot" />
            <span className="desktop-window-dot" />
          </div>
        </div>
      </div>
      <div className="desktop-window-body mate-welcome-body">
        <div className="mate-welcome-copy">
          <h1 id="mate-welcome-title">
            {last ? (
              `${withParticle(last.name, '이', '가')} 기다리고 있었어요`
            ) : (
              <>
                노트북 앞의 시간,
                <br />
                <span>함께 보낼 메이트를 골라요</span>
              </>
            )}
          </h1>
          {last && <p>{state.profile.name}님, 오늘도 옆에 있을게요.</p>}
          <div
            className="mate-welcome-cta"
            onMouseEnter={() => setCtaFocusedOrHovered(true)}
            onMouseLeave={() => setCtaFocusedOrHovered(false)}
            onFocus={() => setCtaFocusedOrHovered(true)}
            onBlur={() => setCtaFocusedOrHovered(false)}
          >
            {last ? (
              <ConnectMateButton mate={last} label="다시 연결하기" />
            ) : (
              <Button onClick={onExplore}>
                메이트 둘러보기 <Icon name="arrow" size={18} className="rotate-90" />
              </Button>
            )}
          </div>
        </div>
        <HeroMateStage
          mateId={heroMate.id}
          fallbackImage={mateHeroPortrait(heroMate.id, heroMate.image)}
          ctaActive={ctaFocusedOrHovered}
        />
      </div>
    </section>
  )
}

function HeroMateStage({
  mateId,
  fallbackImage,
  ctaActive,
}: {
  mateId: string
  fallbackImage?: string
  ctaActive: boolean
}) {
  const sharedWallpaper = useSharedWallpaper()
  const [loginMate] = useState(() => createLoginMateSource().selectMate())
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Live2DStage | null>(null)
  const [status, setStatus] = useState<Live2DStatus>('loading')
  const [reactionState, setReactionState] = useState<MateReactionState>('idle')
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)
  const reactionStateRef = useRef<MateReactionState>('idle')
  const scheduleRef = useRef<ExpressionSchedule>(createExpressionSchedule())
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const idleLongTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fallbackScenario = isLive2DFallbackScenario()
  const allowLive2D =
    mateId === 'chaerin' &&
    loginMate.model !== null &&
    !fallbackScenario &&
    (sharedWallpaper ? sharedWallpaper.canRender3D && sharedWallpaper.degradationStage < 3 : true)

  const applyHeroReaction = useCallback((next: MateReactionState, showLine = true) => {
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

  // Initial greet on enter (reuses existing greet copy)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (reactionStateRef.current === 'idle') {
        applyHeroReaction('greet', true)
      }
    }, 650)
    return () => clearTimeout(timer)
  }, [applyHeroReaction])

  // 20s inactivity -> existing idleLong reaction
  useEffect(() => {
    const resetIdle = () => {
      clearTimeout(idleLongTimerRef.current)
      if (reactionStateRef.current === 'idleLong') {
        reactionStateRef.current = 'idle'
        setReactionState('idle')
      }
      idleLongTimerRef.current = setTimeout(() => {
        if (reactionStateRef.current === 'idle' || reactionStateRef.current === 'greet') {
          applyHeroReaction('idleLong', true)
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
  }, [applyHeroReaction])

  // Cleanup bubble timer on unmount
  useEffect(() => {
    return () => {
      clearTimeout(bubbleTimerRef.current)
      clearTimeout(deadlineTimerRef.current)
    }
  }, [])

  // Mount Live2DStage using the exact same model & cursor tracking as Login
  useEffect(() => {
    const model = loginMate.model
    if (!allowLive2D || !model) return
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

        unsubscribe = created.subscribe(() => {
          const nextStatus = created.getStatus()
          setStatus(nextStatus)
        })

        onVisibility = () => created.setPaused(document.hidden)
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
  }, [allowLive2D, loginMate.model])

  // Apply expression from reaction state or CTA hover/focus smile
  const effectiveState: MateReactionState = ctaActive ? 'greet' : reactionState
  useEffect(() => {
    const stage = stageRef.current
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
    const request = ctaActive
      ? { file: DEFAULT_EXPRESSION_MAPPING.greet, priority: 'state' as const, hold: 'sticky' as const }
      : buildExpressionRequestForState(effectiveState, DEFAULT_EXPRESSION_MAPPING, speechBubble)
    const result = requestExpression(scheduleRef.current, request, now)
    scheduleRef.current = result.schedule
    if (result.command) stage.setExpression(result.command.file)
    scheduleStep(now)

    return () => clearTimeout(deadlineTimerRef.current)
  }, [effectiveState, ctaActive, speechBubble, status])

  const [bgFailed, setBgFailed] = useState(false)
  const live2dReady = allowLive2D && status === 'ready'
  const callBg = chaerinArtwork.callBackground

  return (
    <div
      className="mate-welcome-stage"
      data-mate-mode={live2dReady ? 'live2d' : 'static'}
      style={{ background: CALL_STAGE_GRADIENT }}
    >
      {!bgFailed && (
        <picture className="mate-welcome-bg-picture" aria-hidden="true">
          <source media="(max-width: 900px)" srcSet={callBg.portrait} />
          <img
            src={callBg.landscape}
            alt=""
            aria-hidden="true"
            className="mate-welcome-bg-img"
            draggable={false}
            onError={() => setBgFailed(true)}
          />
        </picture>
      )}
      <div className="mate-welcome-fallback" aria-hidden={live2dReady}>
        {fallbackImage && (
          <img
            src={fallbackImage}
            alt=""
            aria-hidden="true"
            className="mate-welcome-fallback-img"
            draggable={false}
          />
        )}
      </div>

      {allowLive2D && (
        <div className="desktop-mate-live2d-slot" data-visible={live2dReady}>
          <div ref={hostRef} aria-hidden="true" className="live2d-host mate-welcome-live2d-host" data-status={status} />
        </div>
      )}

      <div
        className="desktop-mate-bubble-slot"
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
    </div>
  )
}
