import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useSharedWallpaper } from '@/app/components/shared-wallpaper-context'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments } from '@/features/auth/data/legal-documents'
import {
  DEFAULT_DESKTOP_CONTROLS,
  DEFAULT_EXPRESSION_MAPPING,
  type MateReactionState,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import {
  DesktopShellContext,
  type DesktopShellContextValue,
  type DesktopShellWindowConfig,
} from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'
import { createLoginMateSource } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import {
  REACTION_PRIORITY,
  getDefaultLineForState,
  reactionBubbleDurationMs,
} from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { Dialog } from '@/shared/ui/Dialog'
import { LOGIN_VARIANT_ASSET_DIR, loginVariantAssets } from './login-variant-assets'
import { LOGIN_VARIANTS, LOGIN_VARIANT_LABELS, LOGIN_VARIANT_PARAM, type LoginVariant } from './login-variant'
import { AssembleMateStage } from './assemble/AssembleMateStage'
import type { AssembleForcePhase, AssemblePhase } from './assemble/assemble-machine'
import { VariantMateStage } from './VariantMateStage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import './login-variants.css'

type ReactionOptions = Parameters<DesktopShellContextValue['triggerReaction']>[1]
const ZERO_RECT = { x: 0, y: 0, width: 0, height: 0 }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Mate reactions for the concept screens: greet, field focus, error, success. Same lines as the desktop login. */
function useVariantReactions(autoGreet: boolean) {
  const [state, setState] = useState<MateReactionState>('idle')
  const [nonce, setNonce] = useState(0)
  const [speech, setSpeech] = useState<string | null>(null)
  const stateRef = useRef<MateReactionState>('idle')
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const focusKind = useRef<'none' | 'email' | 'password'>('none')

  const apply = useCallback((next: MateReactionState, options?: ReactionOptions) => {
    if (!options?.force && REACTION_PRIORITY[next] < REACTION_PRIORITY[stateRef.current]) return
    clearTimeout(revertTimer.current)
    stateRef.current = next
    setState(next)
    setNonce((n) => n + 1)
    const line = options?.line !== undefined ? options.line : getDefaultLineForState(next)
    if (line) {
      clearTimeout(bubbleTimer.current)
      setSpeech(line)
      bubbleTimer.current = setTimeout(() => setSpeech(null), reactionBubbleDurationMs(line))
    }
    if (options?.revertAfterMs) {
      revertTimer.current = setTimeout(() => {
        const fallback: MateReactionState =
          focusKind.current === 'password' ? 'passwordFocus' : focusKind.current === 'email' ? 'emailFocus' : 'idle'
        stateRef.current = fallback
        setState(fallback)
      }, options.revertAfterMs)
    }
  }, [])

  const onFocusIn = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      const isPassword = target.type === 'password' || ['password', 'confirmPassword', 'newPassword'].includes(target.name)
      if (isPassword) {
        focusKind.current = 'password'
        apply('passwordFocus', { force: stateRef.current !== 'success' })
      } else if (target.type === 'email' || target.name === 'email') {
        focusKind.current = 'email'
        apply('emailFocus')
      }
    },
    [apply],
  )

  const onFocusOut = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof HTMLInputElement && event.currentTarget.contains(next)) return
    focusKind.current = 'none'
    if (stateRef.current === 'passwordFocus' || stateRef.current === 'emailFocus') {
      stateRef.current = 'idle'
      setState('idle')
    }
  }, [])

  useEffect(() => {
    const greet = autoGreet
      ? setTimeout(() => {
          if (stateRef.current === 'idle') apply('greet', { revertAfterMs: 4600 })
        }, 1000)
      : undefined
    const onSuccess = () => apply('success', { force: true, revertAfterMs: 1200 })
    window.addEventListener('capsule-desktop:login-success', onSuccess)
    return () => {
      if (greet) clearTimeout(greet)
      clearTimeout(bubbleTimer.current)
      clearTimeout(revertTimer.current)
      window.removeEventListener('capsule-desktop:login-success', onSuccess)
    }
  }, [apply, autoGreet])

  return { state, nonce, speech, apply, onFocusIn, onFocusOut }
}

function VariantSwitcher({ current }: { current: LoginVariant }) {
  const location = useLocation()
  return (
    <nav className="login-variant-switcher" aria-label="로그인 화면 시안">
      <span className="login-variant-switcher-label">시안</span>
      {LOGIN_VARIANTS.map((variant) => {
        const params = new URLSearchParams(location.search)
        params.set(LOGIN_VARIANT_PARAM, variant)
        return (
          <Link
            key={variant}
            to={{ pathname: location.pathname, search: `?${params}` }}
            replace
            aria-current={variant === current ? 'true' : undefined}
            className="login-variant-switcher-link"
          >
            {LOGIN_VARIANT_LABELS[variant]}
          </Link>
        )
      })}
    </nav>
  )
}

function IllustrationBackground({ showNote = true }: { showNote?: boolean }) {
  if (loginVariantAssets.illustration) {
    return <img src={loginVariantAssets.illustration} alt="" aria-hidden="true" className="login-variant-bg-media login-variant-illustration-img" draggable={false} />
  }
  // Until the illustration arrives: the room scene with the mate render, composed like a key visual.
  return (
    <div className="login-variant-illustration-fallback" aria-hidden="true">
      <img src={loginVariantAssets.fallbackBackground} alt="" className="login-variant-bg-media" draggable={false} />
      <img src={loginVariantAssets.fallbackMate} alt="" className="login-variant-illustration-mate" draggable={false} />
      {import.meta.env.DEV && showNote && (
        <p className="login-variant-asset-note">
          일러스트를 기다리는 중이에요 · <code>{LOGIN_VARIANT_ASSET_DIR}illustration.webp</code>
        </p>
      )}
    </div>
  )
}

function parseAssembleForcePhase(search: string): AssembleForcePhase {
  const raw = new URLSearchParams(search).get('assemble')?.trim().toLowerCase()
  if (
    raw === 'idle' ||
    raw === 'live' ||
    raw === 'exploding' ||
    raw === 'meshing' ||
    raw === 'assembling' ||
    raw === 'static'
  ) {
    return raw
  }
  return null
}

function parseAssembleDisableEngine(search: string): boolean {
  const raw = new URLSearchParams(search).get('assembleEngine')?.trim().toLowerCase()
  return raw === 'none' || raw === '0' || raw === 'false'
}

export default function LoginVariantLayout({
  variant,
  showSwitcher,
}: {
  variant: Exclude<LoginVariant, 'desktop'>
  showSwitcher: boolean
}) {
  const location = useLocation()
  const sharedWallpaper = useSharedWallpaper()
  const localReducedMotion = usePrefersReducedMotion()
  const reducedMotion = sharedWallpaper?.reducedMotion ?? localReducedMotion
  const canRenderMate = sharedWallpaper?.canRenderMate ?? !reducedMotion
  const [mate] = useState(() => createLoginMateSource().selectMate())
  const [config, setConfig] = useState<DesktopShellWindowConfig | null>(null)
  const reactions = useVariantReactions(variant !== 'assemble')
  const { apply } = reactions
  const assembleForcePhase = useMemo(
    () => (variant === 'assemble' ? parseAssembleForcePhase(location.search) : null),
    [variant, location.search],
  )
  const assembleDisableEngine = useMemo(
    () => (variant === 'assemble' ? parseAssembleDisableEngine(location.search) : false),
    [variant, location.search],
  )
  const handleAssembleGreetBubble = useCallback(() => {
    apply('greet', { revertAfterMs: 4600 })
  }, [apply])
  const [assembleCaption, setAssembleCaption] = useState<{ visible: boolean; immediate: boolean }>(() => ({
    visible: assembleForcePhase === 'live' || assembleForcePhase === 'static',
    immediate: assembleForcePhase === 'live' || assembleForcePhase === 'static' || reducedMotion,
  }))
  const handleAssemblePhaseChange = useCallback((phase: AssemblePhase, immediate: boolean) => {
    const visible = phase === 'live' || phase === 'static'
    setAssembleCaption({ visible, immediate })
  }, [])
  const captionVisible = variant !== 'assemble' || assembleCaption.visible
  const captionImmediate = variant !== 'assemble' || assembleCaption.immediate || reducedMotion

  // The 3D desktop wallpaper sits behind every auth route; these concepts cover it, so stop rendering it.
  useEffect(() => {
    if (!sharedWallpaper) return
    sharedWallpaper.setAuthOverride({
      controls: DEFAULT_DESKTOP_CONTROLS,
      paused: true,
      inputFocused: false,
      windowRects: { mate: ZERO_RECT, login: ZERO_RECT },
      shinyTriggerNonce: 0,
      disableShiny: true,
      captureWallpaperMode: null,
    })
    return () => sharedWallpaper.setAuthOverride(null)
  }, [sharedWallpaper])

  const hasError = config?.hasErrorNotification ?? false
  useEffect(() => {
    if (hasError) apply('error', { force: true, revertAfterMs: 2400 })
  }, [hasError, apply])

  const shell = useMemo<DesktopShellContextValue>(
    () => ({ setWindowConfig: setConfig, triggerReaction: apply }),
    [apply],
  )

  const legal = config?.legalDocument ?? null
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    formRef.current?.scrollTo({ top: 0 })
  }, [config?.scrollResetKey])

  return (
    <DesktopShellContext value={shell}>
      <div className="login-variant-root" data-login-variant={variant} data-reduced-motion={reducedMotion || undefined}>
        <div className="login-variant-bg">
          {variant === 'illustration' && <IllustrationBackground />}
          {variant === 'portrait' && (
            <>
              <img src={loginVariantAssets.fallbackBackground} alt="" aria-hidden="true" className="login-variant-bg-media login-variant-portrait-room" draggable={false} />
              <VariantMateStage
                mate={mate}
                allowLive2D={canRenderMate}
                reactionState={reactions.state}
                reactionNonce={reactions.nonce}
                speech={reactions.speech}
                expressions={DEFAULT_EXPRESSION_MAPPING}
              />
            </>
          )}
          {variant === 'assemble' && (
            <>
              <img src={loginVariantAssets.fallbackBackground} alt="" aria-hidden="true" className="login-variant-bg-media login-variant-portrait-room" draggable={false} />
              <AssembleMateStage
                mate={mate}
                allowLive2D={canRenderMate}
                reducedMotion={reducedMotion}
                reactionState={reactions.state}
                reactionNonce={reactions.nonce}
                forcePhase={assembleForcePhase}
                disableEngine={assembleDisableEngine}
                onGreetBubbleReady={handleAssembleGreetBubble}
                onPhaseChange={handleAssemblePhaseChange}
              />
            </>
          )}
          <div className="login-variant-scrim" />
        </div>

        <div
          className="login-variant-mate-caption"
          data-caption-visible={captionVisible ? 'true' : 'false'}
          data-caption-immediate={captionImmediate ? 'true' : undefined}
          aria-hidden={!captionVisible || undefined}
        >
          <span className="login-variant-mate-name">
            <span className="desktop-mate-dot" aria-hidden="true" />
            {mate.name}
          </span>
          <span className="login-variant-ai-badge">AI 캐릭터입니다</span>
        </div>
        <div className="login-variant-bubble-slot" aria-live="polite" aria-atomic="true">
          {reactions.speech && (
            <p className="login-variant-bubble" role="status">
              <span className="login-variant-bubble-name">{mate.name}</span>
              {reactions.speech}
            </p>
          )}
        </div>

        <main id="main-content" tabIndex={-1} className="login-variant-panel-wrap focus:outline-none">
          <section
            ref={formRef}
            className="login-variant-panel"
            aria-label={config?.windowTitle.replace(/^CAPSULE — /, '') ?? '로그인'}
            onFocusCapture={reactions.onFocusIn}
            onBlurCapture={reactions.onFocusOut}
          >
            <div className="desktop-login-form-host">
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          </section>
        </main>

        {showSwitcher && <VariantSwitcher current={variant} />}

        <Dialog
          open={legal !== null}
          onClose={() => config?.onCloseLegal()}
          title={legal ? legalDocuments[legal].title : ''}
          className="login-variant-legal-dialog"
        >
          {legal && <LegalDocumentBody document={legal} />}
        </Dialog>
      </div>
    </DesktopShellContext>
  )
}
