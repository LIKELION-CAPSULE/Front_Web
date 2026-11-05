import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { Live2DStage } from '../live2d-stage'
import { useLive2DStatus } from '../use-live2d'
import '../live2d.css'

/** A tile's slot for the shared Live2D canvas, over the room background. Hidden until the model is ready. */
export function Live2DFigure({ stage, background }: { stage: Live2DStage; background?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const status = useLive2DStatus(stage)
  useLayoutEffect(() => {
    const node = host.current
    if (!node) return
    stage.attach(node)
    return () => stage.detach(node)
  }, [stage])
  return (
    <div
      ref={host}
      aria-hidden="true"
      className="live2d-host"
      data-status={status ?? undefined}
      style={background ? { '--live2d-background': `url(${JSON.stringify(background)})` } as CSSProperties : undefined}
    />
  )
}
