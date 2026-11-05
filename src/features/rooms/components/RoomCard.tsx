import { Link } from 'react-router'
import type { StudyRoom } from '@/features/rooms/types'
import { BookmarkButton } from '@/shared/ui/BookmarkButton'
import { useDemo } from '@/features/demo/demo-context'
import { RoomArtwork } from './RoomArtwork'
import { RoomTitle } from './RoomTitle'
import { RoomCompanions } from './RoomCompanions'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'
import { findHomeRoomArtwork, getHomeRoomArtwork } from '@/features/rooms/home-artwork'
import { MvpGate } from '@/features/mvp/MvpGate'
import { isMvpRoom } from '@/features/mvp/policy'

export function RoomCard({ room }: { room: StudyRoom }) {
  const { state, dispatch } = useDemo()
  const comingSoon = (!room.serverRoom && !isMvpRoom(room.id)) || room.contentStatus === 'coming-soon'
  const saved = state.savedRooms.includes(room.id)
  const artworkId = room.artworkId ?? room.id
  const homeArtwork = findHomeRoomArtwork(artworkId, room.name)
  const title = homeArtwork
    ? <RoomTitle roomId={artworkId} artwork={homeArtwork} />
    : room.serverRoom && !room.artworkId ? room.name : <RoomTitle roomId={artworkId} />
  function save() {
    dispatch({ type: 'SAVE_ROOM', roomId: room.id })
  }
  const card = (
    <article className="room-card" onPointerMove={moveScene} onPointerLeave={resetScene}>
      <div className="room-card-art">
        {room.serverRoom && room.coverUrl && !homeArtwork ? <img src={room.coverUrl} alt="" className="absolute inset-0 size-full object-cover" /> : <RoomArtwork
          roomId={artworkId}
          artwork={homeArtwork ?? getHomeRoomArtwork(artworkId)}
          variant="seated"
          blurUnavailableCharacters={false}
          interactive
          className="has-title"
        />}
        <RoomCompanions characters={room.characters} className="room-card-companions" blurUnavailableCharacters={false} />
        <h3>
          {comingSoon ? (
            <span className="room-card-title">
              {title}
            </span>
          ) : (
            <Link to={`/rooms/${room.id}`} aria-label={room.name} className="room-card-link">
              <span className="room-card-title">
                {title}
              </span>
            </Link>
          )}
        </h3>
        {!comingSoon && (
          <BookmarkButton
            pressed={saved}
            onClick={save}
            label={`${room.name} ${saved ? '저장 해제' : '저장'}`}
            className="room-save"
          />
        )}
      </div>
    </article>
  )
  return comingSoon ? <MvpGate label={room.name} className="mvp-room">{card}</MvpGate> : card
}
