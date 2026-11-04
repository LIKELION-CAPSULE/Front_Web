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

let serverRooms: readonly StudyRoom[] | null = null
const reportRooms = new Map<string, StudyRoom>()

export function setServerRooms(value: readonly StudyRoom[]) {
  serverRooms = value
  if (!value.length) reportRooms.clear()
}
export function registerReportRoom(room: StudyRoom) { reportRooms.set(room.id, room) }

export function getStudyRooms(): readonly StudyRoom[] {
  return serverRooms ?? rooms
}
export function getStudyRoom(roomId: string): StudyRoom | undefined {
  return getStudyRooms().find((room) => room.id === roomId) ?? reportRooms.get(roomId)
}
