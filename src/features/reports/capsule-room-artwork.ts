import { getRoomArtwork } from '../rooms/artwork'
import { findHomeRoomArtwork } from '../rooms/home-artwork'
import type { StudyRoom } from '../rooms/types'

/** A server's numeric room ID must resolve to the same title in the preview and exported card. */
export function getCapsuleRoomArtwork(room: Pick<StudyRoom, 'id' | 'name' | 'artworkId'>) {
  const id = room.artworkId ?? room.id
  return findHomeRoomArtwork(id, room.name) ?? getRoomArtwork(id)
}
