import { studyRooms } from '@/features/rooms/data/rooms'
import type { StudyRoom } from '@/features/rooms/types'

// A local synchronous read today. API loading/error states belong here when connected.
export function getStudyRooms(): readonly StudyRoom[] {
  return studyRooms
}

export function getStudyRoom(roomId: string): StudyRoom | undefined {
  return studyRooms.find((room) => room.id === roomId)
}
