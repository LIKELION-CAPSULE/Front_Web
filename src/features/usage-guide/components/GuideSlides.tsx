import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { GUIDE_COPY, GUIDE_STEPS } from '../guide-steps'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { GuideArt } from './GuideArt'
import { GuideCopy, GuideDots } from './GuideCopy'

/**
 * One card per step with "이전"/"다음", arrow keys and a horizontal swipe. Used on small screens (`animated`, with
 * soft fades) and with reduced motion (no movement at all), and whenever WebGL is unavailable.
 */
export function GuideSlides({ animated, onStart }: { animated: boolean; onStart: () => void }) {
  const [step, setStep] = useState(0)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const last = step === GUIDE_STEPS.length - 1
  const go = (next: number) => setStep(Math.min(GUIDE_STEPS.length - 1, Math.max(0, next)))

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') go(step + 1)
    else if (event.key === 'ArrowLeft') go(step - 1)
    else return
    event.preventDefault()
  }
  function onPointerUp(event: PointerEvent) {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = event.clientX - start.x
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(step + (dx < 0 ? 1 : -1))
  }

  return (
    <div
      className="usage-guide-slides"
      data-animated={animated || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { swipe.current = null }}
    >
      <div className="usage-guide-slide-art">
        <GuideArt step={step} />
      </div>
      <GuideCopy step={step} />
      <div className="usage-guide-actions">
        {step > 0 && (
          <Button variant="ghost" onClick={() => go(step - 1)} aria-label={GUIDE_COPY.previous}>
            <Icon name="arrow" size={18} className="rotate-180" />
          </Button>
        )}
        {last ? (
          <Button onClick={onStart}>{GUIDE_COPY.start}</Button>
        ) : (
          <Button variant="secondary" onClick={() => go(step + 1)}>
            {GUIDE_COPY.next} <Icon name="arrow" size={18} />
          </Button>
        )}
        <GuideDots step={step} />
      </div>
    </div>
  )
}
