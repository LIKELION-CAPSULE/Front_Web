import { roomArtwork } from './artwork'
import { roomPosterOverrides, roomPosters } from './posters'
import { getRoomAssetId } from './room-asset-id'
import type { StudyRoom } from './types'

/** Use the same poster in room details and the study preparation transition. */
export function getRoomPoster(room: StudyRoom): string | undefined {
  const artwork = roomArtwork[room.artworkId ?? room.id]
  return roomPosterOverrides[getRoomAssetId(room.artworkId ?? room.id, room.name)]
    || room.coverUrl
    || (artwork && roomPosters[artwork.tone])
}
