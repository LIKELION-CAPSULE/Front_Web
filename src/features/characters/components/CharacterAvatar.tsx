import { Avatar } from '@/shared/ui/Avatar'
import { CharacterArtwork } from './CharacterArtwork'

export function CharacterAvatar({ characterId }: { characterId: string }) {
  return (
    <Avatar>
      <CharacterArtwork characterId={characterId} avatar />
    </Avatar>
  )
}
