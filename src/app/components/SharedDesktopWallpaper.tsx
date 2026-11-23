import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router'
import {
  DEFAULT_DESKTOP_CONTROLS,
  LOW_FPS_DEGRADATION,
  STATIC_FALLBACK_WALLPAPERS,
  STATIC_FIRST_PAINT_WALLPAPERS,
  TIME_OF_DAY_PALETTES,
  getDefaultWindowRects,
  resolveTimeBand,
  type TimeOfDayMode,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { emitLoginDesktopEvent, type LoginFallbackReason } from '@/features/auth/login-backgrounds/desktop/login-analytics'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import {
  SharedWallpaperContext,
  type AuthWallpaperOverride,
  type SharedWallpaperContextValue,
} from './shared-wallpaper-context'

const LazyDesktopWallpaper = lazy(
  () => import('@/features/auth/login-backgrounds/desktop/DesktopWallpaper'),
)

const VALID_TIME_MODES = new Set<TimeOfDayMode>(['auto', 'dawn', 'morning', 'day', 'sunset', 'night'])

function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

function readReviewScenarioId(): string | null {
  if (typeof window === 'undefined') return null
  if (document.documentElement.dataset.reviewScenario) {
    return document.documentElement.dataset.reviewScenario
  }
  if (window.name.startsWith('capsule-ui-review:')) {
    return window.name.slice('capsule-ui-review:'.length)
  }
  try {
    return new URLSearchParams(window.location.search).get('__review')
  } catch {
    return null
  }
}

type WallpaperRouteMode = 'auth' | 'calm' | 'paused-static'

function resolveRouteMode(pathname: string): WallpaperRouteMode {
  const clean = pathname.replace(/\/$/, '') || '/'
  if (
    clean === '/login' ||
    clean === '/onboarding' ||
    clean === '/password/reset' ||
    clean === '/reset-password'
  ) {
    return 'auth'
  }
  if (
    clean === '/' ||
    clean === '/mates/me' ||
    clean === '/records' ||
    clean === '/credits' ||
    clean === '/credits/charge' ||
    clean === '/invite' ||
    clean === '/mypage'
  ) {
    return 'calm'
  }
  return 'paused-static'
}

export function SharedDesktopWallpaperProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const routeMode = resolveRouteMode(location.pathname)

  const [authOverride, setAuthOverrideState] = useState<AuthWallpaperOverride | null>(null)
  const setAuthOverride = useCallback((next: AuthWallpaperOverride | null) => {
    setAuthOverrideState(next)
  }, [])

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const devParams = useMemo(() => {
    if (!import.meta.env.DEV) return null
    return new URLSearchParams(location.search)
  }, [location.search])

  const reviewScenario = import.meta.env.DEV ? readReviewScenarioId() : null
  const lowPower = reviewScenario === 'home-lowpower'
  const forceNoWebgl2 = Boolean(devParams?.get('forceNoWebgl2') === '1')
  const [webgl2Available] = useState(() => (forceNoWebgl2 ? false : detectWebGL2()))
  const [degradationStage, setDegradationStage] = useState<0 | 1 | 2 | 3>(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return 0
    const raw = new URLSearchParams(window.location.search).get('forceStage')
    if (raw === '1') return 1
    if (raw === '2') return 2
    if (raw === '3') return 3
    return 0
  })

  const [wallpaperReady, setWallpaperReady] = useState(false)
  const [firstPaintRemoved, setFirstPaintRemoved] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const lowFpsSinceRef = useRef<number | null>(null)
  const fallbackReportedRef = useRef(false)

  const isMobile = viewport.w < 768
  const canRender3D = webgl2Available && !reducedMotion && !isMobile && !lowPower
  // Mate engine does not depend on viewport width (half-screen >=640 is supported; phones are gated by SCR-40)
  const canRenderMate = webgl2Available && !reducedMotion && !lowPower
  const effectivePaused =
    routeMode === 'paused-static' ||
    degradationStage >= 2 ||
    (routeMode === 'auth' ? Boolean(authOverride?.paused) : false)

  // Cross-fade out first-paint tubes-only image once 3D is ready
  useEffect(() => {
    if (!wallpaperReady || firstPaintRemoved) return
    const timer = setTimeout(() => setFirstPaintRemoved(true), 420)
    return () => clearTimeout(timer)
  }, [wallpaperReady, firstPaintRemoved])

  useEffect(() => {
    if (fallbackReportedRef.current) return
    if (!webgl2Available) {
      fallbackReportedRef.current = true
      emitLoginDesktopEvent({ name: 'login_fallback_static', payload: { reason: 'no_webgl2' } })
    } else if (reducedMotion) {
      fallbackReportedRef.current = true
      emitLoginDesktopEvent({ name: 'login_fallback_static', payload: { reason: 'reduced_motion' } })
    }
  }, [webgl2Available, reducedMotion])

  const handleFpsSample = useCallback(
    (sampleFps: number) => {
      setFps(sampleFps)
      if (effectivePaused || document.hidden || !canRender3D) {
        lowFpsSinceRef.current = null
        return
      }
      if (sampleFps < LOW_FPS_DEGRADATION.thresholdFps) {
        const now = performance.now()
        if (lowFpsSinceRef.current === null) {
          lowFpsSinceRef.current = now
        } else if (now - lowFpsSinceRef.current >= LOW_FPS_DEGRADATION.windowMs) {
          lowFpsSinceRef.current = null
          setDegradationStage((prev) => {
            if (prev >= 3) return prev
            const next = (prev + 1) as 1 | 2 | 3
            const reason: LoginFallbackReason =
              next === 1 ? 'low_fps_stage1' : next === 2 ? 'low_fps_stage2' : 'low_fps_stage3'
            emitLoginDesktopEvent({
              name: 'login_fallback_static',
              payload: { reason, fps: sampleFps },
            })
            return next
          })
        }
      } else {
        lowFpsSinceRef.current = null
      }
    },
    [effectivePaused, canRender3D],
  )

  const defaultRects = useMemo(() => getDefaultWindowRects(viewport.w, viewport.h), [viewport.w, viewport.h])
  const devTimeParam = devParams?.get('dTime') as TimeOfDayMode | null
  const fallbackTimeMode: TimeOfDayMode =
    devTimeParam && VALID_TIME_MODES.has(devTimeParam) ? devTimeParam : DEFAULT_DESKTOP_CONTROLS.timeMode

  const activeControls = routeMode === 'auth' && authOverride ? authOverride.controls : DEFAULT_DESKTOP_CONTROLS
  const activeTimeMode = routeMode === 'auth' && authOverride ? authOverride.controls.timeMode : fallbackTimeMode
  const activeTimeBand = resolveTimeBand(activeTimeMode)
  const palette = TIME_OF_DAY_PALETTES[activeTimeBand]
  const firstPaintUrl = STATIC_FIRST_PAINT_WALLPAPERS[activeTimeBand]
  const staticFallbackUrl = STATIC_FALLBACK_WALLPAPERS[activeTimeBand]

  const captureMode = routeMode === 'auth' ? (authOverride?.captureWallpaperMode ?? null) : null
  const isCapture = captureMode === 'tubes' || captureMode === 'fallback'

  const effectiveCapsuleCount =
    captureMode === 'tubes'
      ? 0
      : routeMode === 'calm'
        ? 8
        : activeControls.capsuleCount
  const effectiveCapsuleSpeed =
    routeMode === 'calm'
      ? Math.round(DEFAULT_DESKTOP_CONTROLS.capsuleSpeed * 0.6)
      : activeControls.capsuleSpeed
  const effectiveDisableShiny =
    routeMode !== 'auth' || Boolean(authOverride?.disableShiny) || isCapture

  const fallbackGradientStyle = useMemo(
    () => ({
      background: `radial-gradient(ellipse 75% 58% at 50% 62%, ${palette.glow}38 0%, transparent 72%), linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 52%, ${palette.bottom} 100%)`,
    }),
    [palette],
  )

  const contextValue = useMemo<SharedWallpaperContextValue>(
    () => ({
      webgl2Available,
      reducedMotion,
      isMobile,
      lowPower,
      canRender3D,
      canRenderMate,
      degradationStage,
      setDegradationStage,
      fps,
      setAuthOverride,
    }),
    [webgl2Available, reducedMotion, isMobile, lowPower, canRender3D, canRenderMate, degradationStage, fps, setAuthOverride],
  )

  const showStaticOverlay = !canRender3D || routeMode === 'paused-static'
  const isMateDetailRoute = /^\/mates\/(?!me(?:\/|$))[^/]+/.test(location.pathname)
  const isConnectionRoute = /^\/connect\/[^/]+/.test(location.pathname)
  const isConnectionRecordRoute = /^\/connections\/[^/]+/.test(location.pathname)
  const [hasActivated3D, setHasActivated3D] = useState(() => routeMode !== 'paused-static')
  useEffect(() => {
    if (routeMode !== 'paused-static' && !hasActivated3D) {
      const frame = requestAnimationFrame(() => setHasActivated3D(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [routeMode, hasActivated3D])
  const mount3D = canRender3D && (hasActivated3D || routeMode !== 'paused-static')

  return (
    <SharedWallpaperContext value={contextValue}>
      <div
        className="shared-desktop-wallpaper"
        data-wallpaper-mode={routeMode}
        data-wallpaper-3d={canRender3D && routeMode !== 'paused-static' ? 'live' : 'static'}
        data-wallpaper-paused={effectivePaused ? 'true' : 'false'}
        data-wallpaper-dimmed={isMateDetailRoute || isConnectionRoute || isConnectionRecordRoute ? 'true' : undefined}
        data-degradation-stage={degradationStage}
        style={fallbackGradientStyle}
        aria-hidden="true"
      >
        {showStaticOverlay && staticFallbackUrl && !isCapture && (
          <img
            src={staticFallbackUrl}
            alt=""
            aria-hidden="true"
            className="desktop-wallpaper-static-img"
            data-static-kind={routeMode === 'paused-static' ? 'paused-route' : 'fallback'}
            draggable={false}
          />
        )}
        {canRender3D && routeMode !== 'paused-static' && firstPaintUrl && !firstPaintRemoved && !isCapture && (
          <img
            src={firstPaintUrl}
            alt=""
            aria-hidden="true"
            className="desktop-wallpaper-static-img"
            data-static-kind="first-paint"
            data-fading={wallpaperReady}
            draggable={false}
          />
        )}
        {mount3D && (
          <div
            className="desktop-wallpaper-3d-layer"
            data-ready={wallpaperReady && routeMode !== 'paused-static'}
          >
            <Suspense fallback={null}>
              <LazyDesktopWallpaper
                capsuleCount={effectiveCapsuleCount}
                capsuleSpeed={effectiveCapsuleSpeed}
                purpleAccentRatio={activeControls.purpleAccentRatio}
                shinySpawnChance={routeMode === 'auth' ? activeControls.shinySpawnChance : 0}
                shinyTriggerNonce={routeMode === 'auth' ? (authOverride?.shinyTriggerNonce ?? 0) : 0}
                disableShiny={effectiveDisableShiny}
                timeMode={activeTimeMode}
                hiddenContrast={activeControls.hiddenContrast}
                hiddenScale={activeControls.hiddenScale}
                hiddenOffsetX={activeControls.hiddenOffsetX}
                hiddenOffsetY={activeControls.hiddenOffsetY}
                hiddenLightAngle={activeControls.hiddenLightAngle}
                decoyDensity={activeControls.decoyDensity}
                paused={effectivePaused}
                inputFocused={routeMode === 'auth' ? Boolean(authOverride?.inputFocused) : false}
                degradationStage={degradationStage}
                windowRects={routeMode === 'auth' && authOverride ? authOverride.windowRects : defaultRects}
                onReady={() => setWallpaperReady(true)}
                onFpsSample={handleFpsSample}
                onSecretHover={routeMode === 'auth' ? authOverride?.onSecretHover : undefined}
                onShinyFound={routeMode === 'auth' ? authOverride?.onShinyFound : undefined}
              />
            </Suspense>
          </div>
        )}
      </div>
      <div className="shared-desktop-content">{children}</div>
    </SharedWallpaperContext>
  )
}
