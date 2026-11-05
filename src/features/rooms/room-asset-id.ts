/** Frontend artwork keys stay independent of the backend's room IDs. */
export function getRoomAssetId(roomId: string, name: string) {
  return name.replace(/\s+/g, '') === '밤의호그와트도서관' ? 'hogwarts-night-library' : roomId
}
