import { Link } from 'react-router'
import type { StudyRoom } from '@/features/rooms/types'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { BookmarkButton } from '@/shared/ui/BookmarkButton'
import { useDemo } from '@/features/demo/demo-context'
import { RoomArtwork } from './RoomArtwork'
import { RoomTitle } from './RoomTitle'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'

export function RoomCard({ room }: { room: StudyRoom }) {
  const { state, dispatch } = useDemo()
  const companions = room.characters.map((character) => character.name).join(' · ')
  const lastCode = companions.charCodeAt(companions.length - 1)
  const particle =
    lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0 ? '과' : '와'
  const comingSoon = room.contentStatus === 'coming-soon'
  const saved = state.savedRooms.includes(room.id)
  function save() {
    dispatch({ type: 'SAVE_ROOM', roomId: room.id })
  }
  return (
    <article className="room-card" onPointerMove={moveScene} onPointerLeave={resetScene}>
      <div className="room-card-art">
        <RoomArtwork roomId={room.id} variant="seated" interactive className="has-title" />
        <div className="room-card-companions">
          <span className="room-card-avatars flex shrink-0 -space-x-2">
            {room.characters.map((character) => (
              <CharacterAvatar key={character.id} characterId={character.id} />
            ))}
          </span>
          <p>
            {companions}
            {particle} 함께
          </p>
        </div>
        <h3>
          {comingSoon ? (
            <span className="room-card-title">
              <RoomTitle roomId={room.id} />
            </span>
          ) : (
            <Link to={`/rooms/${room.id}`} aria-label={room.name} className="room-card-link">
              <span className="room-card-title">
                <RoomTitle roomId={room.id} />
              </span>
            </Link>
          )}
        </h3>
        {!comingSoon && (
          <BookmarkButton
            pressed={saved}
            onClick={save}
            label={`${room.name} 저장`}
            className="room-save"
          />
        )}
      </div>
    </article>
  )
}
