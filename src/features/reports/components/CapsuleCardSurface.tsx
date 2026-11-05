import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { cn } from '@/shared/lib/cn'
import { capsuleFoil, capsuleFoilGradient } from '../capsule-card-material'
import { capsuleCardLayout as layout } from '../capsule-card-layout'
import '../capsule-card-effects.css'
import '../capsule-card-layout.css'

function paintSurface(node: HTMLElement, x: number, y: number, active: 'pointer' | 'keyboard' | '') {
  const tilt = window.innerWidth < 700 ? 0.5 : 1
  node.style.setProperty('--capsule-rotate-x', `${(0.5 - y) * 10 * tilt}deg`)
  node.style.setProperty('--capsule-rotate-y', `${(x - 0.5) * 14 * tilt}deg`)
  node.style.setProperty('--capsule-light-x', `${x * 100}%`)
  node.style.setProperty('--capsule-light-y', `${y * 100}%`)
  node.style.setProperty('--capsule-shift-x', `${(x - 0.5) * 36}px`)
  node.style.setProperty('--capsule-shift-y', `${(y - 0.5) * 28}px`)
  node.dataset.active = active
}

export function CapsuleCardSurface({ children, color, light }: { children: ReactNode; color: string; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    const stage = ref.current
    const card = stage?.querySelector<HTMLElement>('.capsule-share-card')
    if (!stage || !card) return
    const resize = () => {
      const scale = Math.min(1, stage.clientWidth / layout.width)
      card.style.zoom = String(scale)
      stage.style.height = `${layout.height * scale}px`
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (reduced && ref.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      pointer.current = null
      paintSurface(ref.current, 0.5, 0.5, '')
    }
    return () => cancelAnimationFrame(frame.current)
  }, [reduced])
  function reset() {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    pointer.current = null
    const node = ref.current
    if (!node) return
    if (!reduced && node.matches(':focus-visible')) paintSurface(node, 0.56, 0.35, 'keyboard')
    else paintSurface(node, 0.5, 0.5, '')
  }
  return (
    <div
      ref={ref}
      className={cn('capsule-card-stage', light && 'is-light')}
      style={{
        '--card-portrait-height': `${layout.portrait.height}px`,
        '--card-intro-top': `${layout.intro.top}px`,
        '--card-study-top': `${layout.study.top}px`,
        '--card-focus-top': `${layout.focus.top}px`,
        '--card-badge-top': `${layout.badge.top}px`,
        '--capsule-foil-gradient': capsuleFoilGradient,
        '--capsule-foil-hover-opacity': light ? capsuleFoil.lightOpacity : capsuleFoil.darkOpacity,
        '--capsule-glitter-hover-opacity': capsuleFoil.glitterOpacity,
        '--capsule-glare-hover-opacity': capsuleFoil.glareOpacity,
      } as CSSProperties}
      role="group"
      aria-label="캡슐 카드 미리보기"
      tabIndex={0}
      onPointerMove={event => {
        if (reduced || event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
        const bounds = event.currentTarget.getBoundingClientRect()
        pointer.current = { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) }
        if (frame.current) return
        frame.current = requestAnimationFrame(() => {
          frame.current = 0
          if (ref.current && pointer.current) paintSurface(ref.current, pointer.current.x, pointer.current.y, 'pointer')
        })
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onFocus={event => {
        if (!reduced && event.currentTarget.matches(':focus-visible')) paintSurface(event.currentTarget, 0.56, 0.35, 'keyboard')
      }}
      onBlur={reset}
    >
      <div className={cn('capsule-share-card', light && 'share-light')} style={{ background: color }}>
        {children}
        <span className="capsule-card-effects" aria-hidden="true">
          <span className="capsule-card-foil" />
          <span className="capsule-card-glitter" />
          <span className="capsule-card-glare" />
        </span>
      </div>
    </div>
  )
}
