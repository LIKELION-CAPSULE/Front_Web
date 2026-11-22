import type { StudyRoom } from '../rooms/types.ts'

/** DUMMY_API:catalog — retain server IDs and fill only content missing from the server. */
export function mergeRoomCatalog(server: readonly StudyRoom[], local: readonly StudyRoom[]): StudyRoom[] {
  const merged = server.map(room => {
    const fallback = local.find(value => value.id === room.artworkId || value.id === room.id || value.name === room.name)
    if (!fallback) return room
    return {
      ...room,
      artworkId: room.artworkId ?? fallback.id,
      coverUrl: room.coverUrl || fallback.coverUrl,
      description: room.description || fallback.description,
      introduction: room.introduction || fallback.introduction,
      characters: [...room.characters.map(character => ({ ...character, artworkId: character.artworkId ?? fallback.characters.find(c => c.id === character.id || c.name === character.name)?.id })), ...fallback.characters.filter(character =>
        !room.characters.some(value => value.id === character.id || value.artworkId === character.id || value.name === character.name))],
    }
  })
  return [...merged, ...local.filter(room => !server.some(value =>
    value.id === room.id || value.artworkId === room.id || value.name === room.name))]
}
