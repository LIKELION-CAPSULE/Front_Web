import type { StudyRoom } from '@/features/rooms/types'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { cn } from '@/shared/lib/cn'
import { withParticle } from '@/shared/lib/korean'

export function RoomCompanions({
  characters,
  className,
}: {
  characters: StudyRoom['characters']
  className?: string
}) {
  const names = characters.map((character) => character.name).join(' · ')
  return (
    <div className={cn('room-companions', className)}>
      <span className="room-card-avatars flex shrink-0 -space-x-2">
        {characters.map((character) => (
          <CharacterAvatar key={character.id} characterId={character.id} />
        ))}
      </span>
      <p>{withParticle(names, '과', '와')} 함께</p>
    </div>
  )
}
