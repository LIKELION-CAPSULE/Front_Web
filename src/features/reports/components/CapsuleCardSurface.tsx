import { useLayoutEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { cn } from '@/shared/lib/cn'
import { capsuleFoil, capsuleFoilGradient } from '../capsule-card-material'
import { capsuleCardLayout as layout } from '../capsule-card-layout'
import { useCapsuleCardTilt } from '../capsule-card-tilt'
import '../capsule-card-effects.css'
import '../capsule-card-layout.css'

export function CapsuleCardSurface({ children, color, light }: { children: ReactNode; color: string; light: boolean }) {
  const reduced = useReducedMotion()
  const { ref, handlers } = useCapsuleCardTilt<HTMLDivElement>(reduced)
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
  }, [ref])
  return (
    <div
      ref={ref}
      className={cn('capsule-card-stage', light && 'is-light')}
      style={{
        '--card-portrait-height': `${layout.portrait.height}px`,
        '--card-room-title-width': `${layout.roomTitle.width}px`,
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
      {...handlers}
    >
      <div className={cn('capsule-share-card', light && 'share-light')} style={{ background: color }}>
        {children}
        <span className="capsule-card-effects" aria-hidden="true">
          <span className="capsule-card-foil" />
          <span className="capsule-card-glitter" />
          <span className="capsule-card-glare" />
          {/* Transparent except for the light that crosses the card once at the end of the opening intro. */}
          <span className="capsule-card-sweep" />
        </span>
      </div>
    </div>
  )
}
