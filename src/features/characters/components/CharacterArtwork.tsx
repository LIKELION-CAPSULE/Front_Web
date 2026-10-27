import { useId } from 'react'
import { getCharacterArtwork, type CharacterPose } from '../artwork'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'

/** Scene composition or an individual portrait window into the original poster. */
export function CharacterArtwork({
  characterId,
  pose = 'study',
  avatar = false,
  variant = 'scene',
  eager = false,
}: {
  characterId: string
  pose?: CharacterPose
  avatar?: boolean
  variant?: 'card' | 'scene' | 'portrait'
  eager?: boolean
}) {
  const clipId = useId()
  const art = getCharacterArtwork(characterId)
  // Cards and profiles share the face crop; avatars and study scenes keep their own frames.
  const cardPortrait = variant !== 'scene' && !avatar ? art.cardPortrait : undefined
  let frame = cardPortrait?.crop ?? (avatar ? (art.avatarCrop ?? art.crop) : art.crop)
  const sourceSize = cardPortrait?.sourceSize ?? art.sourceSize
  if (frame && avatar && !art.avatarCrop) {
    const side = Math.min(frame.width, frame.height)
    frame = { x: frame.x + (frame.width - side) / 2, y: frame.y, width: side, height: side }
  }
  if (!art.sceneId || (avatar && !frame))
    return (
      <img
        src={art[pose]}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        className="character-artwork-image"
        style={{ objectPosition: art.position }}
      />
    )
  if (!frame) return <RoomArtwork roomId={art.sceneId} variant={variant} eager={eager} />
  return (
    <svg
      aria-hidden="true"
      className="character-artwork-foreground"
      data-character={characterId}
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      preserveAspectRatio={avatar ? 'xMidYMid meet' : 'xMidYMid slice'}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect {...frame} />
        </clipPath>
      </defs>
      <image
        href={cardPortrait?.source ?? art.portraitSource ?? art[pose]}
        width={sourceSize?.width ?? 1536}
        height={sourceSize?.height ?? 1024}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )
}
