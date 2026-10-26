import { getCharacterArtwork, type CharacterPose } from '@/features/characters/artwork'
import { cn } from '@/shared/lib/cn'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'
import { characterRoom } from '@/features/rooms/artwork'

export type FigureVariant = 'grid' | 'quiet' | 'focus' | 'small' | 'rest' | 'report' | 'share'
export function CharacterFigure({
  variant = 'grid',
  characterId = 'chaerin',
  pose = 'study',
  className,
}: {
  variant?: FigureVariant
  characterId?: string
  pose?: CharacterPose
  className?: string
}) {
  const art = getCharacterArtwork(characterId)
  const useLayers =
    characterId === 'doyun' ||
    characterId === 'moru' ||
    ((variant === 'report' || variant === 'share') && characterId === 'chaerin')
  return (
    <div aria-hidden="true" className={cn('character-figure', `figure-${variant}`, className)}>
      {useLayers ? (
        <RoomArtwork
          roomId={characterRoom[characterId]!}
          variant={variant === 'report' || variant === 'share' ? 'portrait' : 'scene'}
          eager
        />
      ) : (
        <img src={art[pose]} alt="" style={{ objectPosition: art.position }} />
      )}
    </div>
  )
}
