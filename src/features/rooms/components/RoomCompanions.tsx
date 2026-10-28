import type { StudyRoom } from '@/features/rooms/types'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { cn } from '@/shared/lib/cn'

export function RoomCompanions({
  characters,
  className,
}: {
  characters: StudyRoom['characters']
  className?: string
}) {
  const names = characters.map((character) => character.name).join(' · ')
  const lastCode = names.charCodeAt(names.length - 1)
  const particle =
    lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0 ? '과' : '와'
  return (
    <div className={cn('room-companions', className)}>
      <span className="room-card-avatars flex shrink-0 -space-x-2">
        {characters.map((character) => (
          <CharacterAvatar key={character.id} characterId={character.id} />
        ))}
      </span>
      <p>{names}{particle} 함께</p>
    </div>
  )
}
