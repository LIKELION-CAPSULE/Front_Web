import { Link } from 'react-router'
import type { StudyRoom } from '@/features/rooms/types'
import { BookmarkButton } from '@/shared/ui/BookmarkButton'
import { useDemo } from '@/features/demo/demo-context'
import { RoomArtwork } from './RoomArtwork'
import { RoomTitle } from './RoomTitle'
import { RoomCompanions } from './RoomCompanions'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'

export function RoomCard({ room }: { room: StudyRoom }) {
  const { state, dispatch } = useDemo()
  const comingSoon = room.contentStatus === 'coming-soon'
  const saved = state.savedRooms.includes(room.id)
  function save() {
    dispatch({ type: 'SAVE_ROOM', roomId: room.id })
  }
  return (
    <article className="room-card" onPointerMove={moveScene} onPointerLeave={resetScene}>
      <div className="room-card-art">
        <RoomArtwork roomId={room.id} variant="seated" interactive className="has-title" />
        <RoomCompanions characters={room.characters} className="room-card-companions" />
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
