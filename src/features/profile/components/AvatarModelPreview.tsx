import { useEffect } from 'react'
import type { ModelInfo } from '@/shared/api/types'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useAvatarModel } from '@/features/live2d/use-avatar-model'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'

/** Owns the selected avatar's preview; it never borrows the study companion's model. */
export function AvatarModelPreview({ model, name }: { model: ModelInfo; name: string }) {
  const { stage, status, retry } = useAvatarModel(model)
  const failed = status === 'error'
  const reduced = useReducedMotion()

  useEffect(() => {
    stage?.setTracking(!reduced)
    return () => stage?.setTracking(false)
  }, [stage, reduced])

  return <div className="avatar-dial-model" data-status={status} aria-busy={status === 'loading'}>
    {stage ? <Live2DFigure stage={stage} /> : <div className="avatar-dial-model-status" role="status">
      {failed ? <>
        <p>모델을 불러오지 못했어요.</p>
        <button type="button" className="avatar-dial-model-retry" aria-label={`${name} 모델 다시 불러오기`} onClick={retry}>다시 시도</button>
      </> : <><QuarterRingSpinner /><p>아바타를 불러오고 있어요.</p></>}
    </div>}
  </div>
}
