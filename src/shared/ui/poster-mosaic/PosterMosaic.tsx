import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import './poster-mosaic.css'

export type PosterImage = { id: string; src: string }
type Props = {
  images: readonly PosterImage[]
  rowSpeed?: number
  rotation?: number
  className?: string
}

/** Five seamless poster rows drift in alternating directions. */
export function PosterMosaic({ images, rowSpeed = 24, rotation = -10, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const syncRef = useRef<(() => void) | null>(null)
  const [paused, setPaused] = useState(false)

  useLayoutEffect(() => {
    if (!rootRef.current || !gridRef.current || !images.length) return
    const root = rootRef.current
    const grid = gridRef.current
    const tracks = [...grid.querySelectorAll<HTMLElement>('.poster-mosaic-track')]
    const rowSlots = tracks.map((track) => [
      ...track.querySelectorAll<HTMLElement>('.poster-mosaic-slot'),
    ])
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let context: gsap.Context | undefined
    let tweens: gsap.core.Tween[] = []
    let disposed = false
    let ready = false
    let resizeFrame = 0
    let lastWidth = 0
    let lastHeight = 0

    function syncPlayback() {
      const suspended = pausedRef.current || document.hidden || media.matches
      tweens.forEach((tween) => tween.paused(suspended))
      root.dataset.motion = suspended ? 'paused' : 'playing'
    }
    syncRef.current = syncPlayback

    function measure() {
      const width = root.clientWidth
      const height = root.clientHeight
      const gridWidth = Math.hypot(width, height) * 1.16
      grid.style.setProperty('--mosaic-size', `${gridWidth}px`)
      const gap = parseFloat(getComputedStyle(grid).rowGap)
      lastWidth = width
      lastHeight = height
      // Poster widths vary with their source aspect; repeat exactly one complete set.
      return rowSlots.map((slots) =>
        slots
          .slice(0, images.length)
          .reduce((cycle, slot) => cycle + parseFloat(getComputedStyle(slot).width) + gap, 0),
      )
    }

    function buildRows(cycles: number[]) {
      const progress = tweens.map((tween) => tween.progress())
      context?.revert()
      tweens = []
      context = gsap.context(() => {
        tracks.forEach((track, index) => {
          const cycle = cycles[index]!
          const right = index % 2 === 0
          const tween = gsap.fromTo(
            track,
            { x: right ? -cycle : 0 },
            {
              x: right ? 0 : -cycle,
              duration: cycle / Math.max(4, rowSpeed),
              repeat: -1,
              ease: 'none',
              paused: true,
              lazy: false,
              force3D: true,
            },
          )
          tween.progress(progress[index] ?? 0.2 + index * 0.13)
          tweens.push(tween)
        })
      }, root)
      syncPlayback()
    }

    async function start() {
      root.dataset.ready = 'false'
      measure()
      const uniqueImages = new Map([...grid.querySelectorAll('img')].map((img) => [img.src, img]))
      await Promise.allSettled([...uniqueImages.values()].map((img) => img.decode()))
      if (disposed) return
      // Match every cell to its source, so contain shows the whole poster without bars.
      rowSlots.flat().forEach((slot) => {
        const image = slot.querySelector('img')!
        if (image.naturalWidth && image.naturalHeight)
          slot.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`
      })
      ready = true
      buildRows(measure())
      root.dataset.ready = 'true'
    }

    function onResize() {
      if (root.clientWidth === lastWidth && root.clientHeight === lastHeight) return
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        if (disposed) return
        const cycles = measure()
        if (ready) buildRows(cycles)
      })
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(root)
    media.addEventListener('change', syncPlayback)
    document.addEventListener('visibilitychange', syncPlayback)
    void start()
    return () => {
      disposed = true
      observer.disconnect()
      cancelAnimationFrame(resizeFrame)
      media.removeEventListener('change', syncPlayback)
      document.removeEventListener('visibilitychange', syncPlayback)
      context?.revert()
      syncRef.current = null
    }
  }, [images, rowSpeed, rotation])

  if (!images.length) return null
  const copies = Math.ceil(5 / images.length) + 1
  return (
    <div
      ref={rootRef}
      className={cn('poster-mosaic', className)}
      data-ready="false"
      style={{ '--mosaic-rotation': `${rotation}deg` } as CSSProperties}
    >
      <div ref={gridRef} className="poster-mosaic-grid" aria-hidden="true">
        {Array.from({ length: 5 }, (_, row) => (
          <div
            className="poster-mosaic-row"
            key={row}
            data-direction={row % 2 === 0 ? 'right' : 'left'}
          >
            <div className="poster-mosaic-track">
              {Array.from({ length: copies }, (_, copy) =>
                images.map((_, index) => {
                  const image = images[(index + row * 2) % images.length]!
                  return (
                    <div key={`${copy}-${image.id}`} className="poster-mosaic-slot">
                      <div className="poster-mosaic-tile" data-image-id={image.id}>
                        <img src={image.src} alt="" decoding="async" draggable={false} />
                      </div>
                    </div>
                  )
                }),
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="poster-mosaic-motion-toggle"
        aria-label={paused ? '포스터 애니메이션 재생' : '포스터 애니메이션 일시정지'}
        aria-pressed={paused}
        onClick={() => {
          pausedRef.current = !pausedRef.current
          setPaused(pausedRef.current)
          syncRef.current?.()
        }}
      >
        <Icon name={paused ? 'play' : 'pause'} size={12} />
        <span>{paused ? '재생' : '일시정지'}</span>
      </button>
    </div>
  )
}
