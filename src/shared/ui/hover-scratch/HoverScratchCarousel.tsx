import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createScratchController } from './scratch-controller'
import './scratch.css'

const QUERY =
  '(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const getEnabled = () => window.matchMedia(QUERY).matches
const getServerEnabled = () => false
function subscribe(callback: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

export type ScratchSlide = { id: string; src: string; label: string }
type RenderState<T> = { slide: T; index: number; select: (index: number) => void }

/** A slide's image and HTML share one mask; fixed copy and controls stay above the slide stack. */
export function HoverScratchCarousel<T extends ScratchSlide>({
  slides,
  children,
  renderSlide,
  renderOverlay,
  className,
  labelledBy,
  brushSize = 56,
  threshold = 0.4,
  completionDuration = 460,
}: {
  slides: readonly T[]
  children: (state: RenderState<T>) => ReactNode
  renderSlide?: (slide: T) => ReactNode
  renderOverlay?: (state: RenderState<T>) => ReactNode
  className?: string
  labelledBy: string
  brushSize?: number
  threshold?: number
  completionDuration?: number
}) {
  const [{ index: requestedIndex, revision }, setPosition] = useState({ index: 0, revision: 0 })
  const index = requestedIndex % Math.max(1, slides.length)
  const rootRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const enabled = useSyncExternalStore(subscribe, getEnabled, getServerEnabled)
  const advance = useCallback(() => {
    setPosition((previous) => ({
      index: (previous.index + 1) % slides.length,
      revision: previous.revision + 1,
    }))
  }, [slides.length])
  const select = useCallback(
    (target: number) => {
      if (target < 0 || target >= slides.length) return
      setPosition((previous) => ({ index: target, revision: previous.revision + 1 }))
    },
    [slides.length],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    const frame = frameRef.current
    const canvas = canvasRef.current
    if (!root || !frame || !canvas || !enabled || slides.length < 2) return
    return createScratchController({
      root,
      frame,
      canvas,
      onComplete: advance,
      brushSize: Math.max(16, Math.min(160, brushSize)),
      threshold: Math.max(0.05, Math.min(0.95, threshold)),
      completionDuration: Math.max(150, completionDuration),
    })
  }, [enabled, index, revision, slides, advance, brushSize, threshold, completionDuration])

  const slide = slides[index]
  if (!slide) return null
  const state = { slide, index, select }
  return (
    <section
      ref={rootRef}
      className={['hover-scratch-carousel', className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      data-banner={slide.id}
    >
      <div ref={frameRef} className="scratch-media">
        <div className="scratch-slides">
          {slides.map((item, i) => (
            <div
              key={item.id}
              className="scratch-slide"
              aria-hidden={i !== index}
              data-layer={
                i === index ? 'current' : i === (index + 1) % slides.length ? 'next' : 'hidden'
              }
            >
              <img
                className="scratch-image"
                src={item.src}
                alt={item.label}
                loading="eager"
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'auto'}
                draggable={false}
              />
              {renderSlide?.(item)}
            </div>
          ))}
        </div>
        <canvas ref={canvasRef} className="scratch-mask" aria-hidden="true" />
        {renderOverlay?.(state)}
      </div>
      {children(state)}
    </section>
  )
}
