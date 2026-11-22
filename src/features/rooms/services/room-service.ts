import type { StudyRoom } from '@/features/rooms/types'
let serverRooms: readonly StudyRoom[] = []
const reportRooms = new Map<string, StudyRoom>()

export function setServerRooms(value: readonly StudyRoom[]) {
  serverRooms = value
  if (!value.length) reportRooms.clear()
}
export function registerReportRoom(room: StudyRoom) { reportRooms.set(room.id, room) }

export function getStudyRooms(): readonly StudyRoom[] {
  return serverRooms
}
export function getStudyRoom(roomId: string): StudyRoom | undefined {
  return getStudyRooms().find((room) => room.id === roomId || room.artworkId === roomId) ?? reportRooms.get(roomId)
}
