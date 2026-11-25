/**
 * The mates of the signed-in account as the app's one-mate "rooms" (moved from the retired features/rooms in the
 * 2026-11-25 cleanup). Since 11-25 a room is a mate: `room.id === characters[0].id === String(mate.id)` (11 `mates[]`,
 * backend/adapters.ts `mateRoom`). DemoProvider fills the registry from /home and connections; records of mates no
 * longer on /home are registered so their records still resolve.
 */
export type MateRoomCharacter = {
  artworkId?: string
  serverCharacter?: boolean
  /** Retired 11-22 room relation; no longer sent (37 `relation` replaces it). */
  relation?: { level?: number; levelName?: string; totalStudySeconds?: number; points?: number; stage?: number; stageName?: string }
  id: string
  name: string
  description: string
  avatarUrl?: string
}

export type MateRoom = {
  artworkId?: string
  serverRoom?: boolean
  id: string
  name: string
  description: string
  introduction: string
  coverUrl?: string
  bannerUrl?: string
  characters: readonly MateRoomCharacter[]
  contentStatus: 'preview' | 'coming-soon'
}

let serverRooms: readonly MateRoom[] = []
const reportRooms = new Map<string, MateRoom>()

export function setMateRooms(value: readonly MateRoom[]) {
  serverRooms = value
  if (!value.length) reportRooms.clear()
}
export function registerReportRoom(room: MateRoom) { reportRooms.set(room.id, room) }

export function getMateRooms(): readonly MateRoom[] {
  return serverRooms
}
export function getMateRoom(roomId: string): MateRoom | undefined {
  return getMateRooms().find((room) => room.id === roomId || room.artworkId === roomId) ?? reportRooms.get(roomId)
}
