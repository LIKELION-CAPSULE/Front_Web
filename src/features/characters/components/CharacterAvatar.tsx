import { Avatar } from '@/shared/ui/Avatar'
import { CharacterArtwork } from './CharacterArtwork'

export function CharacterAvatar({ characterId, src }: { characterId: string; src?: string }) {
  return (
    <Avatar>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <CharacterArtwork characterId={characterId} avatar />}
    </Avatar>
  )
}
