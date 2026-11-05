type SavedRoomsStorage = Pick<Storage, 'getItem' | 'setItem'>

const key = (userId: number) => `capsule-saved-rooms:${userId}`
const validUser = (userId: number | undefined): userId is number => typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0

/** Browser preferences stay separate from server data and from other accounts. */
export function readSavedRooms(userId: number | undefined, storage?: Pick<SavedRoomsStorage, 'getItem'>): string[] {
  if (!validUser(userId)) return []
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(key(userId)) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && !!id.trim()))] : []
  } catch { return [] }
}

export function writeSavedRooms(userId: number | undefined, rooms: readonly string[], storage?: Pick<SavedRoomsStorage, 'setItem'>): boolean {
  if (!validUser(userId)) return false
  try {
    (storage ?? localStorage).setItem(key(userId), JSON.stringify(rooms))
    return true
  } catch { return false }
}
