import { studyRooms } from '@/features/rooms/data/rooms'
import type { StudyRoom } from '@/features/rooms/types'
import classroom from '@/assets/rooms/classroom.webp'
import night from '@/assets/rooms/night-study.webp'
import cat from '@/assets/rooms/cat-library.webp'
import { getCharacterArtwork } from '@/features/characters/artwork'

const covers: Record<string, string> = { 'dawn-library': classroom, 'room-2': night, 'room-3': cat }
// Keep image imports out of the domain data used by the reducer and its tests.
const rooms: readonly StudyRoom[] = studyRooms.map((room) => ({
  ...room,
  coverUrl: covers[room.id],
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
