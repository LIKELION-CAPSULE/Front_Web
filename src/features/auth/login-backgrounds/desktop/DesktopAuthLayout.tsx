import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments, type LegalDocumentId } from '@/features/auth/data/legal-documents'
import { chaerinArtwork } from '@/features/mates/artwork'
import { useSharedWallpaper } from '@/app/components/shared-wallpaper-context'
import { DesktopIcons } from './DesktopIcons'
import { DesktopWindow } from './DesktopWindow'
import { MateCallWindow } from './MateCallWindow'
import { MenuBar } from './MenuBar'
import { PhotosWindow } from './PhotosWindow'
import { INITIAL_PHOTO_TAP_STATE, registerPhotoTap } from './photo-unlock'
import {
  DEFAULT_DESKTOP_CONTROLS,
  MENU_BAR_HEIGHT,
  ONBOARDING_WINDOW_WIDTH,
  SECRET_MAX_REACTIONS_PER_VISIT,
  getDefaultLegalWindowRect,
  getDefaultWindowRects,
  getOnboardingWindowRect,
  parseDesktopParams,
  writeDesktopParams,
  type DesktopControls,
  type DesktopIconItem,
  type MateReactionState,
} from './desktop-config'
import { PHOTO_LOCKED_LINE, PHOTO_UNLOCK_CONFIG, type DesktopIconItem as PhotoIconItem } from './desktop-config'
import {
  DesktopShellContext,
  type DesktopShellWindowConfig,
} from './desktop-shell-context'
import { emitLoginDesktopEvent, type LoginFallbackReason } from './login-analytics'
import { createLoginMateSource } from './login-mate-source'
import {
  REACTION_COOLDOWN_MS,
  REACTION_PRIORITY,
  getDefaultLineForState,
  reactionBubbleDurationMs,
} from './mate-reactions'
import './desktop.css'

const LazyDesktopDevPanel = import.meta.env.DEV
  ? lazy(() => import('./DesktopDevPanel'))
  : null

type DesktopWindowId = 'mate' | 'login' | 'legal' | 'photos'

const NOOP = () => {}

const DEFAULT_WINDOW_CONFIG: DesktopShellWindowConfig = {
  windowKey: 'login',
  windowTitle: 'CAPSULE — 시작하기',
  windowWidth: 460,
  mode: 'login',
  legalDocument: null,
  onCloseLegal: NOOP,
  hasErrorNotification: false,
  scrollResetKey: 'welcome',
}

function getInitialWindowConfig(pathname: string): DesktopShellWindowConfig {
  if (pathname === '/onboarding') {
    return {
      windowKey: 'onboarding',
      windowTitle: 'CAPSULE — 프로필 설정',
      windowWidth: ONBOARDING_WINDOW_WIDTH,
      mode: 'onboarding',
      legalDocument: null,
      onCloseLegal: NOOP,
      hasErrorNotification: false,
      scrollResetKey: 'onboarding',
    }
  }
  if (pathname === '/password/reset' || pathname === '/reset-password') {
    return {
      windowKey: 'password-reset',
      windowTitle: 'CAPSULE — 새 비밀번호',
      windowWidth: 460,
      mode: 'password-reset',
      legalDocument: null,
      onCloseLegal: NOOP,
      hasErrorNotification: false,
      scrollResetKey: 'password-reset',
    }
  }
  return DEFAULT_WINDOW_CONFIG
}

function isReviewMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.name.startsWith('capsule-ui-review:')) return true
  try {
    return new URLSearchParams(window.location.search).has('__review')
  } catch {
    return false
  }
}

function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return Boolean(gl)
  } catch {
    return false
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Shared persistent desktop shell for /login, /onboarding, and /password/reset.
 * Keeps Three.js 3D wallpaper, Live2D MateCallWindow, window positions, and shiny state
 * mounted continuously across route transitions without reloading WebGL or Live2D.
 */
export default function DesktopAuthLayout() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const legalTitleId = useId()
  const sharedWallpaper = useSharedWallpaper()

  const reviewMode = import.meta.env.DEV && isReviewMode()

  const controls = useMemo(
    () => (import.meta.env.DEV ? parseDesktopParams(params) : DEFAULT_DESKTOP_CONTROLS),
    [params],
  )

  const captureWallpaperMode = import.meta.env.DEV
    ? (params.get('captureWallpaper') as 'tubes' | 'fallback' | null)
    : null
  const captureWallpaper = captureWallpaperMode === 'tubes' || captureWallpaperMode === 'fallback'

  const initialConfig = useMemo(() => getInitialWindowConfig(location.pathname), [location.pathname])
  const [windowConfig, setWindowConfigState] = useState<DesktopShellWindowConfig>(initialConfig)
  const [routeAnimating, setRouteAnimating] = useState(false)
  const [windowClosing, setWindowClosing] = useState(false)
  const prevWindowKeyRef = useRef<string>(initialConfig.windowKey)
  const prevModeRef = useRef<DesktopShellWindowConfig['mode']>(initialConfig.mode)
  const [loginDragged, setLoginDragged] = useState(false)
  const resetReactionsRef = useRef<(() => void) | null>(null)

  const setWindowConfig = useCallback((next: DesktopShellWindowConfig) => {
    if (prevModeRef.current !== next.mode) {
      prevModeRef.current = next.mode
      resetReactionsRef.current?.()
    }
    setWindowConfigState((prev) => {
      if (
        prev.windowKey === next.windowKey &&
        prev.windowTitle === next.windowTitle &&
        prev.windowWidth === next.windowWidth &&
        prev.mode === next.mode &&
        prev.legalDocument === next.legalDocument &&
        prev.onCloseLegal === next.onCloseLegal &&
        prev.hasErrorNotification === next.hasErrorNotification &&
        prev.scrollResetKey === next.scrollResetKey
      ) {
        return prev
      }
      return next
    })
  }, [])

  const [mate] = useState(() => createLoginMateSource().selectMate())
  const localReducedMotion = usePrefersReducedMotion()
  const reducedMotion = sharedWallpaper?.reducedMotion ?? localReducedMotion
  const webgl2Available = sharedWallpaper?.webgl2Available ?? detectWebGL2()
  const degradationStage = sharedWallpaper?.degradationStage ?? 0
  const setDegradationStage = sharedWallpaper?.setDegradationStage ?? (() => {})
  const fps = sharedWallpaper?.fps ?? null

  const [paused, setPaused] = useState(false)
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [windowOrder, setWindowOrder] = useState<DesktopWindowId[]>(['mate', 'login', 'legal', 'photos'])
  const [legalPosOverride, setLegalPosOverride] = useState<{ x: number; y: number } | null>(null)
  const [photosOpen, setPhotosOpen] = useState(false)
  const [photosPos, setPhotosPos] = useState<{ x: number; y: number } | null>(null)
  const photoTapRef = useRef(INITIAL_PHOTO_TAP_STATE)
  const photosOpenRef = useRef(false)
  useEffect(() => {
    photosOpenRef.current = photosOpen
  }, [photosOpen])
  const [shinyTriggerNonce, setShinyTriggerNonce] = useState(0)
  const [secretTarget, setSecretTarget] = useState<{ x: number; y: number } | null>(null)

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }))
  const [rects, setRects] = useState(() => getDefaultWindowRects(viewport.w, viewport.h))

  const bringToFront = useCallback((id: DesktopWindowId) => {
    setWindowOrder((prev) =>
      prev[prev.length - 1] === id ? prev : [...prev.filter((w) => w !== id), id],
    )
  }, [])

  // Reaction state machine
  const [reactionState, setReactionState] = useState<MateReactionState>('idle')
  const [reactionNonce, setReactionNonce] = useState(0)
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)

  const reactionStateRef = useRef<MateReactionState>('idle')
  const modeRef = useRef(windowConfig.mode)
  const lastBubbleAtRef = useRef<Partial<Record<MateReactionState, number>>>({})
  const secretReactionsCountRef = useRef(0)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stateRevertTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const idleLongTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubbleActiveRef = useRef(false)
  const queuedReactionRef = useRef<{
    state: MateReactionState
    options?: { line?: string | null; force?: boolean; revertAfterMs?: number }
  } | null>(null)
  const applyReactionRef = useRef<
    ((
      nextState: MateReactionState,
      options?: {
        line?: string | null
        force?: boolean
        revertAfterMs?: number
        queueAfter?: MateReactionState
        clearQueue?: boolean
      },
    ) => void) | null
  >(null)
  const loginBodyRef = useRef<HTMLDivElement>(null)
  const legalTitleRef = useRef<HTMLHeadingElement>(null)
  const legalOpenerRef = useRef<HTMLElement | null>(null)
  const prevLegalDocRef = useRef<LegalDocumentId | null>(null)
  const legalReadingFiredRef = useRef(false)
  const draggingMateRef = useRef(false)
  const mateDragOriginRef = useRef<{ x: number; y: number } | null>(null)
  const mateRectRef = useRef(rects.mate)
  const focusedFieldKindRef = useRef<'none' | 'email' | 'password'>('none')

  useEffect(() => {
    reactionStateRef.current = reactionState
  }, [reactionState])

  useEffect(() => {
    modeRef.current = windowConfig.mode
  }, [windowConfig.mode])

  useEffect(() => {
    mateRectRef.current = rects.mate
  }, [rects.mate])

  // Trigger 0.35s window transition animation when switching route windows (e.g. login -> onboarding)
  useEffect(() => {
    if (prevWindowKeyRef.current === windowConfig.windowKey) return
    prevWindowKeyRef.current = windowConfig.windowKey
    if (reducedMotion) return
    const startFrame = requestAnimationFrame(() => setRouteAnimating(true))
    const endTimer = setTimeout(() => setRouteAnimating(false), 380)
    return () => {
      cancelAnimationFrame(startFrame)
      clearTimeout(endTimer)
    }
  }, [windowConfig.windowKey, reducedMotion])

  // Scroll app window body back to top when switching auth view/step
  useEffect(() => {
    const bodyEl = loginBodyRef.current?.closest('.desktop-login-window-body')
    if (bodyEl) bodyEl.scrollTop = 0
  }, [windowConfig.scrollResetKey, windowConfig.windowKey])

  const updateDesktopControls = useCallback(
    (patch: Partial<DesktopControls>) => {
      if (!import.meta.env.DEV) return
      const next: DesktopControls = {
        ...controls,
        ...patch,
        expressions: patch.expressions ? { ...patch.expressions } : controls.expressions,
      }
      setParams((current) => writeDesktopParams(current, next), { replace: true })
    },
    [controls, setParams],
  )

  const showBubble = useCallback((state: MateReactionState, text: string | null, force = false) => {
    if (!text) {
      if (force) {
        clearTimeout(bubbleTimerRef.current)
        bubbleActiveRef.current = false
        setSpeechBubble(null)
      }
      return
    }
    const now = Date.now()
    const cooldown = REACTION_COOLDOWN_MS[state]
    const last = lastBubbleAtRef.current[state]
    if (!force && last !== undefined && now - last < cooldown) {
      return
    }
    lastBubbleAtRef.current[state] = now
    clearTimeout(bubbleTimerRef.current)
    bubbleActiveRef.current = true
    setSpeechBubble(text)
    const duration = reactionBubbleDurationMs(text)
    bubbleTimerRef.current = setTimeout(() => {
      bubbleActiveRef.current = false
      setSpeechBubble(null)
      const queued = queuedReactionRef.current
      if (queued) {
        queuedReactionRef.current = null
        applyReactionRef.current?.(queued.state, queued.options)
      }
    }, duration)
  }, [])

  const applyReaction = useCallback(
    (
      nextState: MateReactionState,
      options?: {
        line?: string | null
        force?: boolean
        revertAfterMs?: number
        queueAfter?: MateReactionState
        clearQueue?: boolean
      },
    ) => {
      if (options?.clearQueue) {
        queuedReactionRef.current = null
      }
      if (
        options?.queueAfter &&
        reactionStateRef.current === options.queueAfter &&
        bubbleActiveRef.current
      ) {
        queuedReactionRef.current = {
          state: nextState,
          options: {
            line: options.line,
            force: true,
            revertAfterMs: options.revertAfterMs,
          },
        }
        return
      }
      const current = reactionStateRef.current
      if (!options?.force && REACTION_PRIORITY[nextState] < REACTION_PRIORITY[current]) {
        return
      }
      clearTimeout(stateRevertTimerRef.current)
      reactionStateRef.current = nextState
      setReactionState(nextState)
      setReactionNonce((n) => n + 1)

      const line = options?.line !== undefined ? options.line : getDefaultLineForState(nextState)
      showBubble(nextState, line, Boolean(options?.force))

      if (options?.revertAfterMs) {
        stateRevertTimerRef.current = setTimeout(() => {
          const fallback: MateReactionState =
            focusedFieldKindRef.current === 'password'
              ? 'passwordFocus'
              : focusedFieldKindRef.current === 'email'
                ? 'emailFocus'
                : 'idle'
          reactionStateRef.current = fallback
          setReactionState(fallback)
        }, options.revertAfterMs)
      }
    },
    [showBubble],
  )

  useEffect(() => {
    applyReactionRef.current = applyReaction
  }, [applyReaction])

  useEffect(() => {
    resetReactionsRef.current = () => {
      clearTimeout(bubbleTimerRef.current)
      clearTimeout(stateRevertTimerRef.current)
      clearTimeout(idleLongTimerRef.current)
      queuedReactionRef.current = null
      bubbleActiveRef.current = false
      focusedFieldKindRef.current = 'none'
      setInputFocused(false)
      reactionStateRef.current = 'idle'
      setReactionState('idle')
      setSpeechBubble(null)
      delete lastBubbleAtRef.current.onboardingGreet
      delete lastBubbleAtRef.current.greet
      delete lastBubbleAtRef.current.emailFocus
      delete lastBubbleAtRef.current.legalReading
    }
  }, [])

  // Initial login greet 1s after mount (ONLY on /login mode)
  useEffect(() => {
    if (captureWallpaper || windowConfig.mode !== 'login') return
    const timer = setTimeout(() => {
      if (modeRef.current === 'login' && reactionStateRef.current === 'idle') {
        applyReaction('greet', { revertAfterMs: 4600 })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [applyReaction, captureWallpaper, windowConfig.mode])

  // 20s inactivity timer -> idleLong (only on /login mode)
  useEffect(() => {
    if (captureWallpaper || windowConfig.mode !== 'login') return
    const resetIdleTimer = () => {
      clearTimeout(idleLongTimerRef.current)
      if (reactionStateRef.current === 'idleLong') {
        reactionStateRef.current = 'idle'
        setReactionState('idle')
      }
      idleLongTimerRef.current = setTimeout(() => {
        if (
          modeRef.current === 'login' &&
          reactionStateRef.current === 'idle' &&
          focusedFieldKindRef.current === 'none' &&
          !draggingMateRef.current
        ) {
          applyReaction('idleLong')
        }
      }, 20_000)
    }

    resetIdleTimer()
    window.addEventListener('pointermove', resetIdleTimer, { passive: true })
    window.addEventListener('keydown', resetIdleTimer, { passive: true })
    window.addEventListener('pointerdown', resetIdleTimer, { passive: true })

    return () => {
      clearTimeout(idleLongTimerRef.current)
      window.removeEventListener('pointermove', resetIdleTimer)
      window.removeEventListener('keydown', resetIdleTimer)
      window.removeEventListener('pointerdown', resetIdleTimer)
    }
  }, [applyReaction, captureWallpaper, windowConfig.mode])

  // Listen for login success event dispatched by LoginPage
  useEffect(() => {
    const onSuccess = (event: Event) => {
      const detail = (event as CustomEvent<{ onboardingRequired?: boolean }>).detail
      if (detail?.onboardingRequired) {
        // Going to onboarding: brief smiling expression only, NO speech bubble
        applyReaction('success', { line: null, force: true, clearQueue: true, revertAfterMs: 1200 })
      } else {
        applyReaction('success', { force: true, clearQueue: true, revertAfterMs: 1200 })
      }
    }
    window.addEventListener('capsule-desktop:login-success', onSuccess)
    return () => window.removeEventListener('capsule-desktop:login-success', onSuccess)
  }, [applyReaction])

  // Observe error notifications from LoginPage (only on /login mode so onboarding age errors stay silent)
  useEffect(() => {
    if (windowConfig.mode === 'login' && windowConfig.hasErrorNotification) {
      applyReaction('error', { revertAfterMs: 4500 })
    }
  }, [windowConfig.hasErrorNotification, windowConfig.mode, applyReaction])

  // Observe form errors ([role="alert"]) inside the login window (ONLY on /login, excluding birthDate alerts)
  useEffect(() => {
    if (windowConfig.mode !== 'login') return
    const root = loginBodyRef.current
    if (!root) return
    const hasNonAgeAlert = () => {
      const alerts = root.querySelectorAll('[role="alert"]')
      for (const el of alerts) {
        const text = el.textContent ?? ''
        if (text.includes('생년월일') || text.includes('만 14세')) continue
        return true
      }
      return false
    }
    let hadAlert = hasNonAgeAlert()
    const observer = new MutationObserver(() => {
      const hasAlert = hasNonAgeAlert()
      if (hasAlert && !hadAlert) {
        applyReaction('error', { revertAfterMs: 4500 })
      }
      hadAlert = hasAlert
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [applyReaction, windowConfig.mode])

  // Keep windows clamped inside viewport on resize
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setViewport({ w, h })
      setRects((prev) => {
        const mateH = Math.min(540, Math.max(440, h - MENU_BAR_HEIGHT - 140))
        const clampWin = (r: { x: number; y: number; width: number; height?: number }) => ({
          ...r,
          x: Math.max(8, Math.min(w - r.width - 8, r.x)),
          y: Math.max(MENU_BAR_HEIGHT + 8, Math.min(h - 96, r.y)),
        })
        return {
          mate: { ...clampWin(prev.mate), height: mateH },
          login: clampWin(prev.login),
        }
      })
      setLegalPosOverride((prev) => {
        if (!prev) return null
        const legalW = Math.min(460, Math.max(400, w - 32))
        return {
          x: Math.max(16, Math.min(w - legalW - 16, prev.x)),
          y: Math.max(MENU_BAR_HEIGHT + 16, Math.min(h - 96, prev.y)),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(bubbleTimerRef.current)
      clearTimeout(stateRevertTimerRef.current)
      clearTimeout(idleLongTimerRef.current)
    }
  }, [])

  const handleLoginFocusIn = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
    setInputFocused(true)

    const mode = windowConfig.mode
    if (mode === 'onboarding') return

    const isPassword =
      target.type === 'password' ||
      target.name === 'password' ||
      target.name === 'confirmPassword' ||
      target.name === 'newPassword'

    if (isPassword) {
      focusedFieldKindRef.current = 'password'
      applyReaction('passwordFocus', { force: reactionStateRef.current !== 'success' })
    } else if (mode === 'login' && (target.type === 'email' || target.name === 'email')) {
      focusedFieldKindRef.current = 'email'
      applyReaction('emailFocus')
    }
  }

  const handleLoginFocusOut = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget
    const container = loginBodyRef.current
    if (next instanceof Node && container?.contains(next)) {
      if (
        next instanceof HTMLInputElement &&
        (next.type === 'password' || (windowConfig.mode === 'login' && next.type === 'email'))
      ) {
        return
      }
    }
    setInputFocused(false)
    const prevKind = focusedFieldKindRef.current
    focusedFieldKindRef.current = 'none'
    if (
      (prevKind === 'password' && reactionStateRef.current === 'passwordFocus') ||
      (prevKind === 'email' && reactionStateRef.current === 'emailFocus')
    ) {
      reactionStateRef.current = 'idle'
      setReactionState('idle')
    }
  }

  const handleMateDragChange = useCallback(
    (dragging: boolean) => {
      draggingMateRef.current = dragging
      if (dragging) {
        mateDragOriginRef.current = { x: mateRectRef.current.x, y: mateRectRef.current.y }
        applyReaction('dragged')
      } else {
        const origin = mateDragOriginRef.current
        mateDragOriginRef.current = null
        if (
          origin &&
          (Math.abs(mateRectRef.current.x - origin.x) > 4 ||
            Math.abs(mateRectRef.current.y - origin.y) > 4)
        ) {
          emitLoginDesktopEvent({
            name: 'login_mate_window_moved',
            payload: { x: mateRectRef.current.x, y: mateRectRef.current.y },
          })
        }
        if (reactionStateRef.current === 'dragged') {
          const fallback: MateReactionState =
            focusedFieldKindRef.current === 'password'
              ? 'passwordFocus'
              : focusedFieldKindRef.current === 'email'
                ? 'emailFocus'
                : 'idle'
          reactionStateRef.current = fallback
          setReactionState(fallback)
        }
      }
    },
    [applyReaction],
  )

  const handleOpenDesktopIcon = useCallback(
    (item: DesktopIconItem) => {
      // While the photos folder is being tapped repeatedly (or is open), its own reactions win over the
      // browser's extra dblclick events, which would otherwise repeat "사진은 비밀이야.".
      if (
        item.id === PHOTO_UNLOCK_CONFIG.folderId &&
        (photosOpenRef.current || photoTapRef.current.count >= 3)
      ) {
        return
      }
      emitLoginDesktopEvent({ name: 'login_desktop_icon_opened', payload: { iconId: item.id } })
      applyReaction('iconOpen', {
        line: item.reactionLine,
        force:
          reactionStateRef.current !== 'success' &&
          reactionStateRef.current !== 'onboardingDone' &&
          reactionStateRef.current !== 'passwordFocus',
        revertAfterMs: 4600,
      })
    },
    [applyReaction],
  )

  // 사진 폴더 이스터에그: 연타 4번 = 당황, 6번 = 폴더 열림 (2번째 더블클릭은 기존 "사진은 비밀이야.")
  const handleDesktopIconTap = useCallback(
    (item: PhotoIconItem) => {
      if (item.id !== PHOTO_UNLOCK_CONFIG.folderId) return
      if (photosOpen) {
        bringToFront('photos')
        return
      }
      const result = registerPhotoTap(photoTapRef.current, performance.now(), PHOTO_UNLOCK_CONFIG)
      photoTapRef.current = result.state
      const blocked =
        reactionStateRef.current === 'success' ||
        reactionStateRef.current === 'onboardingDone' ||
        reactionStateRef.current === 'passwordFocus'
      if (result.stage === 'peek' && !blocked) {
        applyReaction('photosPeek', { force: true, revertAfterMs: 4200 })
      } else if (result.stage === 'open') {
        emitLoginDesktopEvent({ name: 'login_photos_unlocked', payload: { taps: PHOTO_UNLOCK_CONFIG.openAt } })
        photosOpenRef.current = true
        setPhotosOpen(true)
        bringToFront('photos')
        if (!blocked) applyReaction('photosOpen', { force: true, revertAfterMs: 5200 })
      }
    },
    [photosOpen, applyReaction, bringToFront],
  )

  const computeGazeTarget = useCallback(
    (normPos: { x: number; y: number }) => {
      const mateCenterX = (rects.mate.x + rects.mate.width / 2) / Math.max(1, viewport.w)
      const mateCenterY =
        (rects.mate.y + (rects.mate.height ?? 540) * 0.35) / Math.max(1, viewport.h)
      const gx = Math.max(-1, Math.min(1, (normPos.x - mateCenterX) * 2.4))
      const gy = Math.max(-1, Math.min(1, (mateCenterY - normPos.y) * 2.4))
      return { x: gx, y: gy }
    },
    [rects.mate.height, rects.mate.width, rects.mate.x, rects.mate.y, viewport.h, viewport.w],
  )

  const handleSecretHover = useCallback(
    (normPos: { x: number; y: number }) => {
      if (secretReactionsCountRef.current >= SECRET_MAX_REACTIONS_PER_VISIT) return
      secretReactionsCountRef.current++
      emitLoginDesktopEvent({ name: 'login_mate_secret_found', payload: { source: 'hover' } })
      setSecretTarget(computeGazeTarget(normPos))
      applyReaction('secretFound', { revertAfterMs: 4800 })
    },
    [applyReaction, computeGazeTarget],
  )

  const handleShinyFound = useCallback(
    (normPos: { x: number; y: number }) => {
      emitLoginDesktopEvent({ name: 'login_shiny_capsule_found', payload: normPos })
      setSecretTarget(computeGazeTarget(normPos))
      applyReaction('shinyFound', { revertAfterMs: 5200 })
    },
    [applyReaction, computeGazeTarget],
  )

  const isOnboardingMode = windowConfig.mode === 'onboarding'
  const onboardingRect = useMemo(
    () => getOnboardingWindowRect(viewport.w, viewport.h, rects),
    [viewport.w, viewport.h, rects],
  )
  const appWidth = isOnboardingMode
    ? onboardingRect.width
    : Math.min(windowConfig.windowWidth, Math.max(380, viewport.w - 32))
  const appX =
    isOnboardingMode && !loginDragged
      ? onboardingRect.x
      : Math.max(16, Math.min(viewport.w - appWidth - 24, rects.login.x))
  const appY = isOnboardingMode && !loginDragged ? onboardingRect.y : rects.login.y
  const appRect = useMemo(
    () => ({ x: appX, y: appY, width: appWidth }),
    [appX, appY, appWidth],
  )

  // Position notifications top-right below the menu bar (top = MENU_BAR_HEIGHT + 8px = 40px, right = 16px)
  // and clamp max-height so the card never overlaps the right-side auth/profile window at 1440 or 1280.
  useEffect(() => {
    const root = document.documentElement
    const topPx = MENU_BAR_HEIGHT + 8
    const maxCardHeight = Math.max(44, appRect.y - topPx - 4)
    root.style.setProperty('--desktop-notification-top', `${topPx}px`)
    root.style.setProperty('--desktop-notification-right', '16px')
    root.style.setProperty('--desktop-notification-left', 'auto')
    root.style.setProperty('--desktop-notification-width', 'min(380px, calc(100vw - 32px))')
    root.style.setProperty('--desktop-notification-padding', '0px')
    root.style.setProperty('--desktop-notification-card-max-height', `${maxCardHeight}px`)
    root.dataset.desktopCompactNotif = 'true'
    return () => {
      root.style.removeProperty('--desktop-notification-top')
      root.style.removeProperty('--desktop-notification-right')
      root.style.removeProperty('--desktop-notification-left')
      root.style.removeProperty('--desktop-notification-width')
      root.style.removeProperty('--desktop-notification-padding')
      root.style.removeProperty('--desktop-notification-card-max-height')
      delete root.dataset.desktopCompactNotif
    }
  }, [appRect.y])

  const defaultLegalRect = useMemo(
    () => getDefaultLegalWindowRect(viewport.w, viewport.h, appRect, rects.mate),
    [viewport.w, viewport.h, appRect, rects.mate],
  )
  const legalRect = useMemo(
    () =>
      legalPosOverride
        ? {
            x: legalPosOverride.x,
            y: legalPosOverride.y,
            width: defaultLegalRect.width,
            maxHeight: Math.max(320, viewport.h - legalPosOverride.y - 24),
          }
        : defaultLegalRect,
    [legalPosOverride, defaultLegalRect, viewport.h],
  )

  const legalDocument = windowConfig.legalDocument
  const onCloseLegal = windowConfig.onCloseLegal

  // Manage legal window focus, z-order, scroll reset, opener focus restore, and once-per-visit legalReading reaction
  useEffect(() => {
    const prev = prevLegalDocRef.current
    prevLegalDocRef.current = legalDocument

    if (legalDocument) {
      if (prev === null && document.activeElement instanceof HTMLElement) {
        legalOpenerRef.current = document.activeElement
      }
      const frame = requestAnimationFrame(() => {
        bringToFront('legal')
        legalTitleRef.current?.focus({ preventScroll: true })
        const bodyEl = legalTitleRef.current
          ?.closest('[data-desktop-window="legal-doc"]')
          ?.querySelector('.desktop-legal-window-body')
        if (bodyEl) bodyEl.scrollTop = 0

        if (!legalReadingFiredRef.current) {
          legalReadingFiredRef.current = true
          const cx = (legalRect.x + legalRect.width / 2) / Math.max(1, viewport.w)
          const cy =
            (legalRect.y + Math.min(520, legalRect.maxHeight) * 0.35) / Math.max(1, viewport.h)
          setSecretTarget(computeGazeTarget({ x: cx, y: cy }))
          applyReaction('legalReading', { revertAfterMs: 4600 })
        }
      })
      return () => cancelAnimationFrame(frame)
    } else if (prev !== null) {
      const opener = legalOpenerRef.current
      legalOpenerRef.current = null
      const frame = requestAnimationFrame(() => {
        setLegalPosOverride(null)
        if (opener && opener.isConnected) {
          opener.focus({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [legalDocument, bringToFront, applyReaction, computeGazeTarget, legalRect, viewport.w, viewport.h])

  // Sync auth-route wallpaper controls & interaction callbacks to the app-wide SharedDesktopWallpaper
  useEffect(() => {
    if (!sharedWallpaper) return
    sharedWallpaper.setAuthOverride({
      controls,
      paused,
      inputFocused,
      windowRects: { mate: rects.mate, login: appRect },
      shinyTriggerNonce,
      disableShiny: captureWallpaper,
      captureWallpaperMode,
      onSecretHover: handleSecretHover,
      onShinyFound: handleShinyFound,
    })
  }, [
    sharedWallpaper,
    controls,
    paused,
    inputFocused,
    rects.mate,
    appRect,
    shinyTriggerNonce,
    captureWallpaper,
    captureWallpaperMode,
    handleSecretHover,
    handleShinyFound,
  ])

  useEffect(() => {
    if (!sharedWallpaper) return
    return () => sharedWallpaper.setAuthOverride(null)
  }, [sharedWallpaper])

  const shellContextValue = useMemo(
    () => ({
      setWindowConfig,
      setWindowClosing,
      triggerReaction: applyReaction,
    }),
    [setWindowConfig, applyReaction],
  )

  const windowZ = (id: DesktopWindowId) => 10 + windowOrder.indexOf(id) * 2
  const visibleWindows = windowOrder.filter(
    (id) => (id !== 'legal' || legalDocument !== null) && (id !== 'photos' || photosOpen),
  )
  const activeWindowId: DesktopWindowId = visibleWindows[visibleWindows.length - 1] ?? 'login'

  const canRender3D = sharedWallpaper?.canRender3D ?? (webgl2Available && !reducedMotion)
  const allowLive2D =
    canRender3D && degradationStage < 3 && controls.live2dEnabled && mate.model !== null

  const relativeLoginDir =
    appRect.x + appRect.width / 2 - (rects.mate.x + rects.mate.width / 2)
  const appMaxHeight = Math.max(360, viewport.h - appRect.y - (isOnboardingMode ? 14 : 36))
  const effectiveExpressions = import.meta.env.DEV ? controls.expressions : mate.expressions

  const isCompactStack = viewport.w <= 720
  const showDesktopIcons = viewport.w > 1040

  const appWindowAnimClass = windowClosing
    ? 'desktop-window--route-exit'
    : routeAnimating
      ? 'desktop-window--route-enter'
      : undefined

  return (
    <DesktopShellContext value={shellContextValue}>
      <link rel="preload" as="image" href={chaerinArtwork.callBackground.portrait} />
      <div
        className="desktop-login-root"
        data-desktop-fallback={!canRender3D ? (reducedMotion ? 'reduced-motion' : 'no-webgl2') : 'live'}
        data-degradation-stage={degradationStage}
        data-compact-stack={isCompactStack ? 'true' : undefined}
        onPointerDown={(e) => {
          if (!(e.target as Element).closest('.desktop-icon-btn')) {
            setSelectedIconId(null)
          }
        }}
      >
        {!captureWallpaper && (
          <>
            {/* Layer 1: Top OS Menu Bar (includes icon motion pause toggle left of the clock) */}
            <MenuBar
              showMotionToggle={canRender3D && degradationStage < 2}
              motionPaused={paused}
              onToggleMotion={() => setPaused((p) => !p)}
            />

            {isCompactStack ? (
              <div className="desktop-compact-stack">
                <MateCallWindow
                  mate={mate}
                  x={0}
                  y={0}
                  width={Math.min(520, viewport.w - 32)}
                  height={200}
                  zIndex={12}
                  active={activeWindowId === 'mate'}
                  allowLive2D={allowLive2D}
                  compact
                  draggable={false}
                  reactionState={reactionState}
                  reactionNonce={reactionNonce}
                  speechBubble={speechBubble}
                  expressionMapping={effectiveExpressions}
                  relativeLoginDir={0}
                  eyeGazeScale={controls.eyeGazeScale}
                  headGazeScale={controls.headGazeScale}
                  secretTarget={secretTarget}
                  onMove={NOOP}
                  onFocus={() => bringToFront('mate')}
                  onDragStateChange={NOOP}
                />
                <DesktopWindow
                  id="login-app"
                  x={0}
                  y={0}
                  width={Math.min(520, viewport.w - 32)}
                  zIndex={14}
                  active={activeWindowId === 'login'}
                  draggable={false}
                  className={appWindowAnimClass}
                  title={windowConfig.windowTitle}
                  bodyClassName={
                    isOnboardingMode
                      ? 'desktop-login-window-body desktop-login-window-body--onboarding'
                      : 'desktop-login-window-body'
                  }
                  onMove={NOOP}
                  onFocus={() => bringToFront('login')}
                >
                  <div
                    ref={loginBodyRef}
                    className="desktop-login-form-host"
                    onFocusCapture={handleLoginFocusIn}
                    onBlurCapture={handleLoginFocusOut}
                  >
                    <Suspense fallback={null}>
                      <Outlet />
                    </Suspense>
                  </div>
                </DesktopWindow>
              </div>
            ) : (
              <>
                {/* Layer 2 (DOM-first for keyboard Tab order): Active App Window (/login, /onboarding, /password/reset) */}
                <DesktopWindow
                  id="login-app"
                  x={appRect.x}
                  y={appRect.y}
                  width={appRect.width}
                  maxHeight={appMaxHeight}
                  zIndex={windowZ('login')}
                  active={activeWindowId === 'login'}
                  className={appWindowAnimClass}
                  title={windowConfig.windowTitle}
                  bodyClassName={
                    isOnboardingMode
                      ? 'desktop-login-window-body desktop-login-window-body--onboarding'
                      : 'desktop-login-window-body'
                  }
                  onMove={(x, y) => {
                    setLoginDragged(true)
                    setRects((prev) => ({ ...prev, login: { ...prev.login, x, y } }))
                  }}
                  onFocus={() => bringToFront('login')}
                >
                  <div
                    ref={loginBodyRef}
                    className="desktop-login-form-host"
                    onFocusCapture={handleLoginFocusIn}
                    onBlurCapture={handleLoginFocusOut}
                  >
                    <Suspense fallback={null}>
                      <Outlet />
                    </Suspense>
                  </div>
                </DesktopWindow>

                {/* Layer 4: Persistent Mate Call Window */}
                <MateCallWindow
                  mate={mate}
                  x={rects.mate.x}
                  y={rects.mate.y}
                  width={rects.mate.width}
                  height={rects.mate.height ?? 540}
                  zIndex={windowZ('mate')}
                  active={activeWindowId === 'mate'}
                  allowLive2D={allowLive2D}
                  reactionState={reactionState}
                  reactionNonce={reactionNonce}
                  speechBubble={speechBubble}
                  expressionMapping={effectiveExpressions}
                  relativeLoginDir={relativeLoginDir}
                  eyeGazeScale={controls.eyeGazeScale}
                  headGazeScale={controls.headGazeScale}
                  secretTarget={secretTarget}
                  onMove={(x, y) => setRects((prev) => ({ ...prev, mate: { ...prev.mate, x, y } }))}
                  onFocus={() => bringToFront('mate')}
                  onDragStateChange={handleMateDragChange}
                />
              </>
            )}

            {/* Layer 3: Non-modal Legal Document Window */}
            {legalDocument && (
              <DesktopWindow
                id="legal-doc"
                role="dialog"
                ariaModal={false}
                ariaLabelledBy={legalTitleId}
                x={isCompactStack ? 16 : legalRect.x}
                y={isCompactStack ? MENU_BAR_HEIGHT + 16 : legalRect.y}
                width={isCompactStack ? Math.min(520, viewport.w - 32) : legalRect.width}
                maxHeight={isCompactStack ? Math.max(320, viewport.h - MENU_BAR_HEIGHT - 32) : legalRect.maxHeight}
                zIndex={windowZ('legal')}
                active={activeWindowId === 'legal'}
                draggable={!isCompactStack}
                title={
                  <h2 ref={legalTitleRef} id={legalTitleId} tabIndex={-1} className="desktop-legal-title">
                    CAPSULE — {legalDocuments[legalDocument].title}
                  </h2>
                }
                bodyClassName="desktop-legal-window-body"
                onClose={onCloseLegal}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    onCloseLegal()
                  }
                }}
                onMove={(x, y) => setLegalPosOverride({ x, y })}
                onFocus={() => bringToFront('legal')}
              >
                <LegalDocumentBody document={legalDocument} />
              </DesktopWindow>
            )}

            {/* Layer 3b: 사진 폴더 (easter egg; only where desktop icons are shown) */}
            {photosOpen && showDesktopIcons && (
              <PhotosWindow
                x={photosPos?.x ?? 156}
                y={photosPos?.y ?? MENU_BAR_HEIGHT + 24}
                width={Math.min(380, viewport.w - 180)}
                zIndex={windowZ('photos')}
                active={activeWindowId === 'photos'}
                onMove={(x, y) => setPhotosPos({ x, y })}
                onFocus={() => bringToFront('photos')}
                onClose={() => {
                  photosOpenRef.current = false
                  setPhotosOpen(false)
                  document.querySelector<HTMLButtonElement>('.desktop-icon-btn[aria-pressed="true"]')?.focus()
                }}
                onView={(photo) => {
                  emitLoginDesktopEvent({ name: 'login_photo_viewed', payload: { photoId: photo.id } })
                  applyReaction('photosOpen', { line: photo.line, force: reactionStateRef.current !== 'passwordFocus', revertAfterMs: 4600 })
                }}
                onLocked={() => applyReaction('photosPeek', { line: PHOTO_LOCKED_LINE, force: true, revertAfterMs: 3600 })}
              />
            )}

            {/* Layer 5: Desktop Icons (hidden at <= 1040px so half-screen stays clean) */}
            {showDesktopIcons && (
              <DesktopIcons
                selectedId={selectedIconId}
                onSelect={setSelectedIconId}
                onOpen={handleOpenDesktopIcon}
                onTap={handleDesktopIconTap}
              />
            )}

            {/* Dev-only panel (hidden in __review mode) */}
            {import.meta.env.DEV && !reviewMode && LazyDesktopDevPanel && (
              <Suspense fallback={null}>
                <LazyDesktopDevPanel
                  controls={controls}
                  fps={fps}
                  reactionState={reactionState}
                  degradationStage={degradationStage}
                  onUpdateControls={updateDesktopControls}
                  onForceReaction={(st) => applyReaction(st, { force: true })}
                  onTriggerShiny={() => setShinyTriggerNonce((n) => n + 1)}
                  onResetWindows={() => setRects(getDefaultWindowRects(viewport.w, viewport.h))}
                  onSetDegradationStage={(stage) => {
                    setDegradationStage(stage)
                    if (stage > 0) {
                      const reason: LoginFallbackReason =
                        stage === 1
                          ? 'low_fps_stage1'
                          : stage === 2
                            ? 'low_fps_stage2'
                            : 'low_fps_stage3'
                      emitLoginDesktopEvent({
                        name: 'login_fallback_static',
                        payload: { reason },
                      })
                    }
                  }}
                />
              </Suspense>
            )}
          </>
        )}
      </div>
    </DesktopShellContext>
  )
}
