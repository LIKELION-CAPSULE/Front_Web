import type { StudyRoom } from '@/features/rooms/types'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { cn } from '@/shared/lib/cn'
import { withParticle } from '@/shared/lib/korean'
import { isMvpCharacter } from '@/features/mvp/policy'
import { MvpGate } from '@/features/mvp/MvpGate'

export function RoomCompanions({
  characters,
  className,
  blurUnavailableCharacters = true,
}: {
  characters: StudyRoom['characters']
  className?: string
  blurUnavailableCharacters?: boolean
}) {
  const available = blurUnavailableCharacters ? characters.filter(character => isMvpCharacter(character.id)) : characters
  const names = (available.length ? available : characters).map((character) => character.name).join(' · ')
  return (
    <div className={cn('room-companions', className)}>
      <span className="room-card-avatars flex shrink-0 -space-x-2">
        {characters.map((character) => (
          !blurUnavailableCharacters || isMvpCharacter(character.id)
            ? <CharacterAvatar key={character.id} characterId={character.id} />
            : <MvpGate key={character.id} label={character.name} className="mvp-avatar" compact inline>
                <CharacterAvatar characterId={character.id} />
              </MvpGate>
        ))}
      </span>
      <p>{withParticle(names, '과', '와')} 함께</p>
    </div>
  )
}
