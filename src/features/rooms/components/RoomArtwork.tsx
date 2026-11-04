import type { CSSProperties, ReactNode } from 'react'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'
import { getRoomArtwork, type RoomArtwork as RoomArtworkData } from '@/features/rooms/artwork'
import { cn } from '@/shared/lib/cn'
import { RoomTitle } from './RoomTitle'
import { MvpClassroomImage } from '@/features/mvp/MvpClassroomImage'
import {
  getSceneBackground,
  getSceneSettings,
  type SceneVariant,
} from '../composition'

export function RoomArtwork({
  roomId,
  artwork,
  variant = 'card',
  showTitle = false,
  blurUnavailableCharacters = true,
  interactive = false,
  eager = false,
  className,
  children,
}: {
  roomId: string
  artwork?: RoomArtworkData
  variant?: SceneVariant
  showTitle?: boolean
  blurUnavailableCharacters?: boolean
  interactive?: boolean
  eager?: boolean
  className?: string
  children?: ReactNode
}) {
  const art = artwork ?? getRoomArtwork(roomId)
  const placement = getSceneSettings(art, variant)
  const style = {
    '--subject-width': `${placement.width * 100}%`,
    '--subject-center': `${placement.center * 100}%`,
    '--subject-offset': `${-placement.anchor * 100}%`,
    '--subject-max-height': placement.maxHeight * 100,
    '--subject-aspect': placement.aspect,
    '--scene-surface': `${placement.surfaceY * 100}%`,
  } as CSSProperties
  return (
    <div
      aria-hidden="true"
      data-scene={art.tone}
      style={style}
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
        src={getSceneBackground(art, variant)}
        alt=""
        className="scene-background"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      {blurUnavailableCharacters && art.tone === 'classroom' ? (
        <MvpClassroomImage src={art.subject} width={art.subjectSize[0]} height={art.subjectSize[1]} className="scene-subject" />
      ) : <img
        src={art.subject}
        alt=""
        className="scene-subject"
        width={art.subjectSize[0]}
        height={art.subjectSize[1]}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />}
      <div className="scene-shade" />
      {showTitle && (
        <div className="scene-title">
          <RoomTitle roomId={roomId} eager={eager} />
        </div>
      )}
      {children}
    </div>
  )
}
