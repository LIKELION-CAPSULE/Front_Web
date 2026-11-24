import { useEffect, useRef } from 'react'
import type { ModelInfo } from '@/shared/api/types'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useAvatarModel } from '@/features/live2d/use-avatar-model'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'

/**
 * A selection that changes again within this time never creates the model's WebGL context (arrow keys held, quick
 * clicks through the rail). The model already on screen covers the wait.
 */
export const AVATAR_PREVIEW_DELAY_MS = 160
/** The new model fades in over the previous one for this long before the previous one is released (avatar-dial.css). */
export const AVATAR_PREVIEW_FADE_MS = 280

/**
 * Owns one avatar's Live2D preview; it never borrows the study companion's model. Mounted with a key per avatar, so
 * unmounting fully releases the model (WebGL context, textures, ticker). `onShown` reports once the model is drawn and
 * has faded in, so the picker can release the model it replaces.
 */
export function AvatarModelPreview({ model, name, leaving = false, onShown }: {
  model: ModelInfo
  name: string
  /** The model being replaced: kept drawn (no status UI) until the new one is shown. */
  leaving?: boolean
  onShown?: () => void
}) {
  const { stage, status, retry } = useAvatarModel(model, '', undefined, AVATAR_PREVIEW_DELAY_MS)
  const failed = status === 'error'
  const reduced = useReducedMotion()
  const shownRef = useRef(onShown)
  useEffect(() => { shownRef.current = onShown }, [onShown])

  useEffect(() => {
    stage?.setTracking(!reduced && !leaving)
    return () => stage?.setTracking(false)
  }, [stage, reduced, leaving])

  useEffect(() => {
    if (status !== 'ready' || leaving) return
    const timer = setTimeout(() => shownRef.current?.(), reduced ? 0 : AVATAR_PREVIEW_FADE_MS)
    return () => clearTimeout(timer)
  }, [status, leaving, reduced])

  return <div className="avatar-picker-model" data-status={status} data-leaving={leaving || undefined} aria-busy={status === 'loading'}>
    {stage && <Live2DFigure stage={stage} />}
    {!leaving && (failed
      ? <div className="avatar-picker-model-status" role="status">
        <p>움직이는 모습을 불러오지 못했어요.</p>
        <button type="button" className="avatar-picker-retry" aria-label={`${name} 다시 불러오기`} onClick={retry}>다시 시도</button>
      </div>
      : !stage && <div className="avatar-picker-model-status" role="status">
        <QuarterRingSpinner />
        <span className="sr-only">아바타를 불러오고 있어요.</span>
      </div>)}
  </div>
}
