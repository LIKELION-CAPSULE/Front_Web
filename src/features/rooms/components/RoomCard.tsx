import { Link } from 'react-router'
import type { StudyRoom } from '@/features/rooms/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Icon } from '@/shared/ui/Icon'
import { useDemo } from '@/features/demo/demo-context'
import { RoomArtwork } from './RoomArtwork'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { moveScene, resetScene } from '@/features/rooms/scene-motion'
import { useToast } from '@/shared/ui/toast-context'

export function RoomCard({ room, index = 0 }: { room: StudyRoom; index?: number }) {
  const { state, dispatch } = useDemo()
  const comingSoon = room.contentStatus === 'coming-soon'
  const saved = state.savedRooms.includes(room.id)
  const notify = useToast()
  function save() {
    dispatch({ type: 'SAVE_ROOM', roomId: room.id })
    notify({
      message: saved ? `${room.name} 저장을 해제했어요.` : `${room.name}을 저장했어요.`,
      action: {
        label: '되돌리기',
        onClick: () => dispatch({ type: 'SAVE_ROOM', roomId: room.id }),
      },
    })
  }
  return (
    <article className="room-card" onPointerMove={moveScene} onPointerLeave={resetScene}>
      <div className="room-card-art">
        <RoomArtwork roomId={room.id} showTitle interactive />
        <span className="room-card-number">0{index + 1}</span>
        <span className="room-card-category">{getRoomArtwork(room.id).mood}</span>
        {!comingSoon && (
          <button
            type="button"
            aria-pressed={saved}
            onClick={save}
            aria-label={`${room.name} 저장`}
            className="room-save"
          >
            <Icon name="bookmark" size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
        <div className="room-card-art-footer">
          <span>
            <span className="live-dot" />
            {comingSoon ? 'COMING SOON' : '지금 입장 가능'}
          </span>
          <span>1 : {room.characters.length}</span>
        </div>
      </div>
      <div className="room-card-content">
        <div className="flex items-center justify-between gap-3">
          <h3>
            {comingSoon ? (
              room.name
            ) : (
              <Link to={`/rooms/${room.id}`} className="after:absolute after:inset-0">
                {room.name}
              </Link>
            )}
          </h3>
          <Icon name="arrow" size={19} className="shrink-0 text-subtle" />
        </div>
        <p className="room-card-description">{room.description}</p>
        <div className="room-card-friends">
          <span className="flex -space-x-2">
            {room.characters.map((character) => (
              <Avatar key={character.id} src={character.avatarUrl} />
            ))}
          </span>
          <p>
            {room.characters.map((character) => character.name).join(' · ')}
            <span className="ml-1 text-subtle">와 함께</span>
          </p>
          <span className="ml-auto text-[11px] text-subtle">50 + 10 min</span>
        </div>
      </div>
    </article>
  )
}
