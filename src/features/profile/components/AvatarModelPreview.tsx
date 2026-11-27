import { useEffect, useRef, type ReactNode } from 'react'
import type { ModelInfo } from '@/shared/api/types'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useAvatarModel } from '@/features/live2d/use-avatar-model'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'

/**
 * A selection that changes again within this time never creates the model's WebGL context (arrow keys held, quick
 * clicks through the rail). The model already on screen covers the wait.
 */
export const AVATAR_PREVIEW_DELAY_MS = 160

/**
 * Owns one avatar's Live2D preview; it never borrows the study companion's model. Mounted with a key per avatar, so
 * unmounting fully releases the model (WebGL context, textures, ticker). `onShown` reports once the model is drawn (it
 * starts fading in), so the picker fades the stand-in still out under it. `leaving`: the model fades out quickly
 * before the picker releases it (never on screen with the next avatar).
 */
export function AvatarModelPreview({ model, avatarKey, leaving = false, still, onShown, onFailed }: {
  model: ModelInfo
  /** Which choice this is (`data-avatar`, for checks that two avatars are never visible together). */
  avatarKey?: string
  /** The model being replaced: kept drawn (no status UI) until the new one is shown. */
  leaving?: boolean
  /** This avatar's still (thumbnail or default image), shown when the model fails to load. */
  still?: ReactNode
  onShown?: () => void
  /** The model failed: the picker releases the model it was keeping on screen and surfaces retry under the name. */
  onFailed?: (retry: () => void) => void
}) {
  const { stage, status, retry } = useAvatarModel(model, '', undefined, AVATAR_PREVIEW_DELAY_MS)
  const failed = status === 'error'
  const reduced = useReducedMotion()
  const shownRef = useRef(onShown)
  const failedRef = useRef(onFailed)
  useEffect(() => { shownRef.current = onShown; failedRef.current = onFailed }, [onShown, onFailed])

  useEffect(() => {
    stage?.setTracking(!reduced && !leaving)
    return () => stage?.setTracking(false)
  }, [stage, reduced, leaving])

  useEffect(() => {
    if (status === 'ready' && !leaving) shownRef.current?.()
  }, [status, leaving])

  useEffect(() => {
    if (failed && !leaving) failedRef.current?.(retry)
  }, [failed, leaving, retry])

  return <div className="avatar-picker-model" data-status={status} data-leaving={leaving || undefined} data-avatar={avatarKey} aria-busy={status === 'loading'}>
    {failed && !leaving && still && <div className="avatar-picker-still" aria-hidden="true">{still}</div>}
    {stage && <Live2DFigure stage={stage} />}
    {/* Loading shows nothing on the stage but its light (AvatarDial pulses it when slow); said to screen readers. */}
    {!leaving && !failed && !stage && <div className="sr-only" role="status">아바타를 불러오고 있어요.</div>}
  </div>
}
