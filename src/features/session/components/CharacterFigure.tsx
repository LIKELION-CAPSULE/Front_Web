import { getCharacterArtwork, type CharacterPose } from '@/features/characters/artwork'
import { CharacterArtwork } from '@/features/characters/components/CharacterArtwork'
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
  const portrait = variant === 'report' || variant === 'share'
  return (
    <div aria-hidden="true" className={cn('character-figure', `figure-${variant}`, className)}>
      {portrait && (characterId === 'chaerin' || getCharacterArtwork(characterId).sceneId) ? (
        <RoomArtwork roomId={characterRoom[characterId]!} variant="portrait" eager />
      ) : (
        <CharacterArtwork
          characterId={characterId}
          pose={pose}
          variant={portrait ? 'portrait' : 'scene'}
          eager
        />
      )}
    </div>
  )
}
