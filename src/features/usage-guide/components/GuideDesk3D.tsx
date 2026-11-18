import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GUIDE, GUIDE_STEP_RANGES } from '../guide-timeline'
import { GUIDE_COPY, GUIDE_STEPS } from '../guide-steps'
import type { GuideScene } from '../scene/guide-scene'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { GuideCopy, GuideDots } from './GuideCopy'
import { GuideScreen } from './GuideScreen'

/**
 * The scroll-driven desk: scrolling inside the overlay (or "다음") turns the desk, dives into the monitor, then
 * brings the notebook and pencil forward. three.js loads here only, when the guide opens on a large screen.
 */
export function GuideDesk3D({ onFail, onStart }: { onFail: () => void; onStart: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const scene = useRef<GuideScene | null>(null)
  const failed = useRef(onFail)
  const [ready, setReady] = useState(false)
  const [frame, setFrame] = useState({ step: 0, screenStep: 0 })

  useEffect(() => {
    failed.current = onFail
  })

  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    Promise.all([import('../scene/guide-scene'), import('../scene/guide-runtime')])
      .then(([{ createGuideScene }, { startGuideRuntime }]) => {
        if (disposed) return
        try {
          scene.current = createGuideScene(canvas.current!)
        } catch {
          // No WebGL2: the overlay switches to the slides.
          return failed.current()
        }
        stop = startGuideRuntime({ scroller: scroller.current!, stage: stage.current!, screen: screen.current! }, scene.current, setFrame)
        setReady(true)
      })
      .catch(() => {
        if (!disposed) failed.current()
      })
    return () => {
      disposed = true
      stop?.()
      // Geometries, materials, textures, the environment map and the renderer itself all go with the overlay.
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  const last = frame.step === GUIDE_STEPS.length - 1
  function next() {
    const element = scroller.current
    if (!element) return
    const target = GUIDE_STEP_RANGES[Math.min(frame.step + 1, GUIDE_STEP_RANGES.length - 1)]!.settle
    element.scrollTo({ top: target * (element.scrollHeight - element.clientHeight), behavior: 'smooth' })
  }

  return (
    <div ref={scroller} className="usage-guide-scroller" data-ready={ready || undefined}>
      <div className="usage-guide-track" style={{ '--guide-length': GUIDE.scrollLength } as CSSProperties}>
        <div ref={stage} className="usage-guide-stage">
          <div ref={screen} className="usage-guide-screen" aria-hidden="true" inert>
            <GuideScreen step={frame.screenStep} />
          </div>
          <canvas ref={canvas} className="usage-guide-canvas" aria-hidden="true" />
          <div className="usage-guide-panel">
            <GuideCopy step={frame.step} />
            <div className="usage-guide-actions">
              {last ? (
                <Button onClick={onStart}>
                  {GUIDE_COPY.start} <Icon name="arrow" size={18} />
                </Button>
              ) : (
                <Button variant="secondary" onClick={next}>
                  {GUIDE_COPY.next} <Icon name="arrow" size={18} className="rotate-90" />
                </Button>
              )}
              <GuideDots step={frame.step} />
            </div>
            <p className="usage-guide-hint" data-hidden={frame.step > 0 || undefined}>
              {GUIDE_COPY.scrollHint}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
