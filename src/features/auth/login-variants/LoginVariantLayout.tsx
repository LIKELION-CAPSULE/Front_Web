import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { Outlet, useLocation } from 'react-router'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments } from '@/features/auth/data/legal-documents'
import type { MateReactionState } from '@/features/auth/login-backgrounds/desktop/desktop-config'
import {
  DesktopShellContext,
  type DesktopShellContextValue,
  type DesktopShellWindowConfig,
} from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'
import { createLoginMateSource } from '@/features/auth/login-backgrounds/desktop/login-mate-source'
import { REACTION_PRIORITY, getDefaultLineForState } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { Dialog } from '@/shared/ui/Dialog'
import { chaerinArtwork } from '@/features/mates/artwork'
import { AssembleMateStage } from './assemble/AssembleMateStage'
import { MateDialogue } from './MateDialogue'
import { isMateAwake, parseAssembleForcePhase, type AssemblePhase } from './assemble/assemble-machine'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import './login-variants.css'

/**
 * DEV-only login drafts (`/login?variant=doze`, see doze/). `import.meta.env.DEV` is a build-time constant, so the
 * production bundle has neither these modules nor their assets.
 */
const DozeMateStage = import.meta.env.DEV ? lazy(() => import('./doze/DozeMateStage')) : null
const LoginVariantDevSwitch = import.meta.env.DEV ? lazy(() => import('./doze/LoginVariantDevSwitch')) : null

type ReactionOptions = Parameters<DesktopShellContextValue['triggerReaction']>[1]

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

/**
 * Mate reactions on the login screen: greet, field focus, error, success. Same lines as the desktop login.
 * Chaerin only reacts once she is awake (see `isMateAwake`): before that, reactions are dropped (not queued), so
 * nothing is said or announced while she is still the 2D card or mid-transform.
 */
function useMateReactions() {
  const [state, setState] = useState<MateReactionState>('idle')
  const [nonce, setNonce] = useState(0)
  /** Current line; `id` changes per line so the same text said again restarts the dialogue box. */
  const [speech, setSpeech] = useState<{ id: number; text: string } | null>(null)
  const speechId = useRef(0)
  const stateRef = useRef<MateReactionState>('idle')
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const focusKind = useRef<'none' | 'email' | 'password'>('none')
  /** Read synchronously by `apply`, so a reaction fired right after the phase change sees the new value. */
  const awakeRef = useRef(false)
  const [awake, setAwakeState] = useState(false)

  const apply = useCallback((next: MateReactionState, options?: ReactionOptions) => {
    // Asleep: drop the reaction entirely (no line, no expression state). Keeping `state` at idle also means a field
    // focused before waking cannot outrank the greeting; `focusKind` is still tracked so the revert lands correctly.
    if (!awakeRef.current) return
    if (!options?.force && REACTION_PRIORITY[next] < REACTION_PRIORITY[stateRef.current]) return
    clearTimeout(revertTimer.current)
    stateRef.current = next
    setState(next)
    setNonce((n) => n + 1)
    const line = options?.line !== undefined ? options.line : getDefaultLineForState(next)
    // How long the line stays is decided by the dialogue box: its reading time starts after typing has finished.
    if (line) setSpeech({ id: ++speechId.current, text: line })
    if (options?.revertAfterMs) {
      revertTimer.current = setTimeout(() => {
        const fallback: MateReactionState =
          focusKind.current === 'password' ? 'passwordFocus' : focusKind.current === 'email' ? 'emailFocus' : 'idle'
        stateRef.current = fallback
        setState(fallback)
      }, options.revertAfterMs)
    }
  }, [])

  /** Follows the wake-up phase. Going back to sleep (replay) clears the current line and any pending revert. */
  const setAwake = useCallback((next: boolean) => {
    if (awakeRef.current === next) return
    awakeRef.current = next
    setAwakeState(next)
    if (!next) {
      clearTimeout(revertTimer.current)
      stateRef.current = 'idle'
      setState('idle')
      setNonce((n) => n + 1)
      setSpeech(null)
    }
  }, [])

  /** Called by the dialogue box when its line has been read; a newer line is left alone. */
  const endSpeech = useCallback((id: number) => {
    setSpeech((current) => (current?.id === id ? null : current))
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
    const onSuccess = () => apply('success', { force: true, revertAfterMs: 1200 })
    window.addEventListener('capsule-desktop:login-success', onSuccess)
    return () => {
      clearTimeout(revertTimer.current)
      window.removeEventListener('capsule-desktop:login-success', onSuccess)
    }
  }, [apply])

  return { state, nonce, speech: awake ? speech : null, endSpeech, apply, setAwake, onFocusIn, onFocusOut }
}

function parseAssembleDisableEngine(search: string): boolean {
  const raw = new URLSearchParams(search).get('assembleEngine')?.trim().toLowerCase()
  return raw === 'none' || raw === '0' || raw === 'false'
}

/** `/login` layout: the wake-up ("채린 깨우기") stage on the left, the login form panel on the right. */
export default function LoginVariantLayout() {
  const location = useLocation()
  const localReducedMotion = usePrefersReducedMotion()
  const reducedMotion = localReducedMotion
  const canRenderMate = !reducedMotion
  const [mate] = useState(() => createLoginMateSource().selectMate())
  const [config, setConfig] = useState<DesktopShellWindowConfig | null>(null)
  const reactions = useMateReactions()
  const { apply, setAwake } = reactions
  const assembleForcePhase = useMemo(
    () => parseAssembleForcePhase(new URLSearchParams(location.search).get('assemble')),
    [location.search],
  )
  const assembleDisableEngine = useMemo(
    () => parseAssembleDisableEngine(location.search),
    [location.search],
  )
  const handleAssembleGreetBubble = useCallback(() => {
    apply('greet', { revertAfterMs: 4600 })
  }, [apply])
  const [assembleCaption, setAssembleCaption] = useState<{ visible: boolean; immediate: boolean }>(() => ({
    visible: isMateAwake(assembleForcePhase),
    immediate: assembleForcePhase === 'live' || assembleForcePhase === 'static' || reducedMotion,
  }))
  const handleAssemblePhaseChange = useCallback(
    (phase: AssemblePhase, immediate: boolean) => {
      const awake = isMateAwake(phase)
      setAwake(awake)
      setAssembleCaption({ visible: awake, immediate })
    },
    [setAwake],
  )
  const dozeVariant =
    import.meta.env.DEV && new URLSearchParams(location.search).get('variant')?.trim().toLowerCase() === 'doze'
  const handleDozeAwakeChange = useCallback(
    (awake: boolean, immediate: boolean) => {
      setAwake(awake)
      setAssembleCaption({ visible: awake, immediate })
    },
    [setAwake],
  )
  const handleDozeGreet = useCallback((line: string) => apply('greet', { line, revertAfterMs: 4600 }), [apply])
  const captionVisible = assembleCaption.visible
  const captionImmediate = assembleCaption.immediate || reducedMotion

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
      <div
        className="login-variant-root"
        data-reduced-motion={reducedMotion || undefined}
      >
        <div className="login-variant-bg">
          <img src={chaerinArtwork.callBackground.landscape} alt="" aria-hidden="true" className="login-variant-bg-media login-variant-room" draggable={false} />
          {dozeVariant && DozeMateStage ? (
            <Suspense fallback={null}>
              <DozeMateStage
                mate={mate}
                allowLive2D={canRenderMate}
                reducedMotion={reducedMotion}
                reactionState={reactions.state}
                reactionNonce={reactions.nonce}
                onGreet={handleDozeGreet}
                onAwakeChange={handleDozeAwakeChange}
              />
            </Suspense>
          ) : (
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
          <span className="login-variant-ai-badge">AI 캐릭터</span>
        </div>
        {/* Laid over the bottom of the stage (same geometry as the stage), never over the form panel. */}
        <div className="login-dialogue-layer">
          {reactions.speech && (
            <MateDialogue
              key={reactions.speech.id}
              id={reactions.speech.id}
              name={mate.name}
              text={reactions.speech.text}
              reducedMotion={reducedMotion}
              onDone={reactions.endSpeech}
            />
          )}
        </div>
        {/* Screen readers get the whole line once here; the typed text in the box is aria-hidden. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {reactions.speech ? `${mate.name}: ${reactions.speech.text}` : ''}
        </div>

        <main id="main-content" tabIndex={-1} className="login-variant-panel-wrap focus:outline-none">
          <section
            className="login-variant-panel"
            aria-label={config?.windowTitle.replace(/^CAPSULE — /, '') ?? '로그인'}
            onFocusCapture={reactions.onFocusIn}
            onBlurCapture={reactions.onFocusOut}
          >
            <div ref={formRef} className="login-variant-panel-scroll">
              <div className="desktop-login-form-host">
                <Suspense fallback={null}>
                  <Outlet />
                </Suspense>
              </div>
            </div>
          </section>
        </main>

        {LoginVariantDevSwitch && (
          <Suspense fallback={null}>
            <LoginVariantDevSwitch />
          </Suspense>
        )}

        <Dialog
          open={legal !== null}
          onClose={() => config?.onCloseLegal()}
          title={legal ? legalDocuments[legal].title : ''}
          // Wider than the 512px Dialog default for long legal text; small screens still fill the width.
          className="login-variant-legal-dialog max-w-3xl"
        >
          {legal && <LegalDocumentBody document={legal} />}
        </Dialog>
      </div>
    </DesktopShellContext>
  )
}
