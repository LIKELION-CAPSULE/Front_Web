import { studyRooms } from '@/features/rooms/data/rooms'
import type { StudyRoom } from '@/features/rooms/types'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { roomPosters } from '@/features/rooms/posters'

// Keep image imports out of the domain data used by the reducer and its tests.
const rooms: readonly StudyRoom[] = studyRooms.map((room) => ({
  ...room,
  coverUrl: roomPosters[getRoomArtwork(room.id).tone],
  characters: room.characters.map((character) => ({
    ...character,
    avatarUrl: getCharacterArtwork(character.id).study,
  })),
}))

// A local synchronous read today. API loading/error states belong here when connected.
export function getStudyRooms(): readonly StudyRoom[] {
  return rooms
}
export function getStudyRoom(roomId: string): StudyRoom | undefined {
  return rooms.find((room) => room.id === roomId)
}
