import type { HomeResponse } from '../../shared/api/types.ts'

export type MateProfile = {
  id: string
  name: string
  introduction: string
  description: string
  role: string
  intro: string
  farewellLine?: string
  tags: readonly string[]
  ageRating: 'all'
  /** Home card: relationship style and a one-line introduction. */
  relationTag?: string
  tagline?: string
}

/** Only approved launch characters belong here. The male mate has not been supplied yet. */
export const launchMates: readonly MateProfile[] = [{
  id: 'chaerin',
  name: '채린',
  introduction: '시험기간에 같이 있는 귀여운 여고생',
  description: '',
  role: '당신은 채린의 같은 반 친구예요',
  intro: '',
  tags: [],
  ageRating: 'all',
  relationTag: '연애형',
  tagline: '시간이 지나도, 변하지 않는 마음이 있어요.',
}]

export type AvailableMate = MateProfile & {
  /** Compatibility with the currently published room/session API; never invented locally. */
  roomId: string
  characterId: string
  image?: string
}

// Temporary display mapping explicitly requested by the user on 2026-11-22.
// Server IDs, model URLs and source responses keep their original identity.
const sourceNames: Readonly<Record<string, readonly string[]>> = {
  chaerin: ['채린', '말포이 TS', '말포이'],
}
const normalizedName = (name: string | undefined) => name?.replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
export function mateProfileByName(name: string | undefined) {
  const normalized = normalizedName(name)
  return normalized ? launchMates.find(profile => (sourceNames[profile.id] ?? [profile.name]).some(value => normalizedName(value) === normalized)) : undefined
}

const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** Do not supplement the server catalogue with the old nine-room demo catalogue. */
export function availableMates(home: HomeResponse | null): AvailableMate[] {
  const result: AvailableMate[] = []
  for (const profile of launchMates) {
    // Prefer a real Chaerin entry when both the new and temporary source exist.
    for (const sourceName of sourceNames[profile.id] ?? [profile.name]) {
      for (const room of home?.rooms ?? []) {
        if (!validId(room.id)) continue
        const character = room.characters?.find(value => normalizedName(value.name) === normalizedName(sourceName) && validId(value.id))
        if (!character || !validId(character.id)) continue
        const farewellLine =
          typeof (character as { farewellLine?: unknown }).farewellLine === 'string' &&
          (character as { farewellLine: string }).farewellLine.trim()
            ? (character as { farewellLine: string }).farewellLine.trim()
            : profile.farewellLine
        result.push({
          ...profile,
          ...(farewellLine ? { farewellLine } : {}),
          roomId: String(room.id),
          characterId: String(character.id),
          image: character.profileImageUrl,
        })
        break
      }
      if (result.some(value => value.id === profile.id)) break
    }
  }
  return result
}

export function mateByName(name: string | undefined, mates: readonly AvailableMate[]) {
  const profile = mateProfileByName(name)
  return profile ? mates.find(mate => mate.id === profile.id) : undefined
}
