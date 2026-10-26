import type { ReactNode } from 'react'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { cn } from '@/shared/lib/cn'

type Variant = 'card' | 'hero' | 'scene' | 'portrait' | 'thumb'
export function RoomArtwork({
  roomId,
  variant = 'card',
  showTitle = false,
  interactive = false,
  eager = false,
  className,
  children,
}: {
  roomId: string
  variant?: Variant
  showTitle?: boolean
  interactive?: boolean
  eager?: boolean
  className?: string
  children?: ReactNode
}) {
  const art = getRoomArtwork(roomId)
  return (
    <div
      aria-hidden="true"
      data-scene={art.tone}
      className={cn(
        'layered-scene',
        `layered-scene--${variant}`,
        interactive && 'is-interactive',
        showTitle && 'has-title',
        className,
      )}
      onPointerMove={interactive ? moveScene : undefined}
      onPointerLeave={interactive ? resetScene : undefined}
    >
      <img
        src={art.background}
        alt=""
        className="scene-background"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <img
        src={art.subject}
        alt=""
        className="scene-subject"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div className="scene-shade" />
      {showTitle && (
        <div className="scene-title">
          <span>{art.subtitle}</span>
          <strong>{art.title}</strong>
        </div>
      )}
      {children}
    </div>
  )
}
