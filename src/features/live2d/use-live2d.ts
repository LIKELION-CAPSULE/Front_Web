import { useEffect, useState, useSyncExternalStore } from 'react'
import { ExpressionDirector } from './expression-director'
import type { SessionModelStage } from './session-model'

const idle = () => () => {}
export function useLive2DStatus(stage: SessionModelStage | null) {
  return useSyncExternalStore(stage?.subscribe ?? idle, () => stage?.getStatus() ?? null, () => null)
}

/** One director per study page; it follows whichever stage is current. */
export function useExpressionDirector(stage: SessionModelStage | null) {
  const [director] = useState(() => new ExpressionDirector())
  useEffect(() => { director.setStage(stage) }, [director, stage])
  useEffect(() => () => director.dispose(), [director])
  return director
}
