import { getRoomArtwork } from '@/features/rooms/artwork'

/** A separate transparent title layer; alt text retains the readable room name. */
export function RoomTitle({ roomId, eager = false }: { roomId: string; eager?: boolean }) {
  const art = getRoomArtwork(roomId)
  return (
    <img
      src={art.titleImage}
      alt={art.title.replace(/\s+/g, ' ')}
      width={art.titleImageSize[0]}
      height={art.titleImageSize[1]}
      className="room-title-image"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  )
}
